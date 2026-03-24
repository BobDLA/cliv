import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const desktopTargetDir =
  process.env.CLIV_DESKTOP_TARGET_DIR ||
  path.join(repoRoot, "src-tauri", "target", "desktop-e2e");
const binaryPath =
  process.env.CLIV_DESKTOP_BINARY_PATH ||
  path.join(
    desktopTargetDir,
    "debug",
    os.platform() === "win32" ? "cliv.exe" : "cliv",
  );
const driverExecutable =
  os.platform() === "win32" ? "tauri-driver.exe" : "tauri-driver";
const desktopScenario = process.env.CLIV_DESKTOP_SCENARIO ?? "standalone";
const skipBuild = process.env.CLIV_DESKTOP_SKIP_BUILD === "1";

if (skipBuild && !fs.existsSync(binaryPath)) {
  throw new Error(
    `Desktop smoke binary not found at ${binaryPath}. Run without CLIV_DESKTOP_SKIP_BUILD=1 first, or set CLIV_DESKTOP_BINARY_PATH.`,
  );
}

const scenarioWorkspace = ensureScenarioWorkspace(desktopScenario);
const appArgs = scenarioWorkspace.appArgs;
const applicationPath = scenarioWorkspace.applicationPath ?? binaryPath;

process.env.CLIV_DESKTOP_WORKSPACE = scenarioWorkspace.workspaceDir;
process.env.CLIV_DESKTOP_COMPOSE_PATH = scenarioWorkspace.composePath ?? "";
process.env.CLIV_DESKTOP_REPLY_PATH = scenarioWorkspace.replyPath ?? "";
process.env.CLIV_DESKTOP_METADATA_PATH = scenarioWorkspace.metadataPath ?? "";
process.env.CLIV_DESKTOP_EXPECTED_HEADING = scenarioWorkspace.expectedHeading ?? "";
process.env.CLIV_DESKTOP_EXPECTED_ERROR = scenarioWorkspace.expectedError ?? "";
process.env.CLIV_DESKTOP_LOG_PATH = scenarioWorkspace.logPath ?? "";

let tauriDriver;
let exit = false;

export const config = {
  host: "127.0.0.1",
  port: 4444,
  specs: ["./specs/**/*.e2e.js"],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: applicationPath,
        args: appArgs,
      },
    },
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  onPrepare: () => {
    if (skipBuild) {
      return;
    }

    const frontend = spawnSync("pnpm", ["build"], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
    });

    if (frontend.status !== 0) {
      throw new Error("Failed to build frontend dist for desktop smoke tests");
    }

    const cargo = spawnSync(
      "cargo",
      [
        "build",
        "--manifest-path",
        path.join("src-tauri", "Cargo.toml"),
        "-F",
        "tauri/custom-protocol",
        "--target-dir",
        desktopTargetDir,
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
        shell: true,
      },
    );

    if (cargo.status !== 0) {
      throw new Error("Failed to build desktop smoke Tauri binary");
    }
  },
  beforeSession: () => {
    tauriDriver = spawn(resolveTauriDriver(), resolveNativeDriverArgs(), {
      stdio: [null, process.stdout, process.stderr],
    });

    tauriDriver.on("error", (error) => {
      console.error("tauri-driver error:", error);
      process.exit(1);
    });
    tauriDriver.on("exit", (code) => {
      if (!exit) {
        console.error("tauri-driver exited with code:", code);
        process.exit(1);
      }
    });
  },
  afterSession: () => {
    closeTauriDriver();
  },
};

function ensureScenarioWorkspace(scenario) {
  const workspaceDir =
    process.env.CLIV_DESKTOP_WORKSPACE ||
    fs.mkdtempSync(path.join(os.tmpdir(), `cliv-desktop-${scenario}-`));

  fs.mkdirSync(workspaceDir, { recursive: true });

  switch (scenario) {
    case "metadata":
      return writeMetadataWorkspace(workspaceDir);
    case "missing-reply":
      return writeMissingReplyWorkspace(workspaceDir);
    case "gemini-pid-only":
      return writeGeminiPidOnlyWorkspace(workspaceDir);
    case "trusted-caller-only":
      return writeTrustedCallerOnlyWorkspace(workspaceDir);
    default:
      return writeStandaloneWorkspace(workspaceDir);
  }
}

function writeStandaloneWorkspace(workspaceDir) {
  const composePath = path.join(workspaceDir, "compose.md");

  fs.writeFileSync(
    composePath,
    [
      "# Desktop Smoke Fixture",
      "",
      "## Review Target",
      "",
      "This fixture is loaded through Tauri CLI args so the desktop smoke test can verify the real file-loading path.",
      "",
      "### Write Back Section",
      "",
      "The test appends text here and checks that the compose file is updated on disk.",
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    workspaceDir,
    composePath,
    replyPath: composePath,
    metadataPath: null,
    expectedHeading: "Desktop Smoke Fixture",
    expectedError: null,
    logPath: null,
    applicationPath: null,
    appArgs: ["--compose", composePath, composePath],
  };
}

function writeMetadataWorkspace(workspaceDir) {
  const composePath = path.join(workspaceDir, "compose.md");
  const replyPath = path.join(workspaceDir, "reply.md");
  const metadataPath = path.join(workspaceDir, "metadata.json");

  fs.writeFileSync(
    composePath,
    [
      "# Metadata Compose Target",
      "",
      "This file is the desktop write-back target.",
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    replyPath,
    [
      "# Metadata Reply Fixture",
      "",
      "This reply is loaded from metadata and rendered in the desktop app.",
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        version: "1",
        session: { id: "desktop-session", name: "Desktop Smoke" },
        turn: {
          id: "desktop-turn",
          agent: "claude",
          createdAt: "2026-03-19T00:00:00Z",
        },
        reply: { path: replyPath },
        target: { mode: "compose", composePath },
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    workspaceDir,
    composePath,
    replyPath,
    metadataPath,
    expectedHeading: "Metadata Reply Fixture",
    expectedError: null,
    logPath: null,
    applicationPath: null,
    appArgs: ["--compose", composePath, "--metadata", metadataPath],
  };
}

function writeMissingReplyWorkspace(workspaceDir) {
  const composePath = path.join(workspaceDir, "compose.md");
  const missingReplyPath = path.join(workspaceDir, "missing-reply.md");
  const metadataPath = path.join(workspaceDir, "metadata.json");

  fs.writeFileSync(
    composePath,
    [
      "# Broken Metadata Compose Target",
      "",
      "This file exists, but the metadata points to a missing reply file.",
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        version: "1",
        session: { id: "broken-session", name: "Broken Metadata" },
        turn: {
          id: "broken-turn",
          agent: "claude",
          createdAt: "2026-03-19T00:00:00Z",
        },
        reply: { path: missingReplyPath },
        target: { mode: "compose", composePath },
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    workspaceDir,
    composePath,
    replyPath: missingReplyPath,
    metadataPath,
    expectedHeading: null,
    expectedError: `Reply file not found: ${missingReplyPath}`,
    logPath: null,
    applicationPath: null,
    appArgs: ["--compose", composePath, "--metadata", metadataPath],
  };
}

function writeGeminiPidOnlyWorkspace(workspaceDir) {
  ensureWrapperScenarioSupported("gemini-pid-only");

  const composePath = path.join(workspaceDir, "compose.md");
  const homeDir = path.join(workspaceDir, "home");
  const logPath = path.join(homeDir, ".cliv", "cliv.log");

  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(
    composePath,
    [
      "# Gemini Compose Target",
      "",
      "This file is passed as the write-back target while the reply is loaded from the Gemini pid cache.",
      "",
    ].join("\n"),
    "utf8",
  );

  const applicationPath = writeNodeWrapper(
    path.join(workspaceDir, "gemini"),
    buildGeminiWrapperSource({ homeDir }),
  );

  return {
    workspaceDir,
    composePath,
    replyPath: null,
    metadataPath: null,
    expectedHeading: "Gemini PID Reply Fixture",
    expectedError: null,
    logPath,
    applicationPath,
    appArgs: ["--compose", composePath],
  };
}

function writeTrustedCallerOnlyWorkspace(workspaceDir) {
  ensureWrapperScenarioSupported("trusted-caller-only");

  const composePath = path.join(workspaceDir, "compose.md");
  const homeDir = path.join(workspaceDir, "home");
  const logPath = path.join(homeDir, ".cliv", "cliv.log");

  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(
    composePath,
    [
      "# Trusted Caller Compose Target",
      "",
      "This file should be treated as a write target only.",
      "",
    ].join("\n"),
    "utf8",
  );

  const applicationPath = writeNodeWrapper(
    path.join(workspaceDir, "mycli"),
    buildTrustedCallerWrapperSource({ homeDir }),
  );

  return {
    workspaceDir,
    composePath,
    replyPath: null,
    metadataPath: null,
    expectedHeading: null,
    expectedError: null,
    logPath,
    applicationPath,
    appArgs: [composePath],
  };
}

function ensureWrapperScenarioSupported(scenario) {
  if (os.platform() === "win32") {
    throw new Error(`${scenario} desktop smoke scenario is only supported on Unix-like systems`);
  }
}

function writeNodeWrapper(wrapperPath, source) {
  fs.writeFileSync(wrapperPath, `#!/usr/bin/env node\n${source}`, "utf8");
  fs.chmodSync(wrapperPath, 0o755);
  return wrapperPath;
}

function buildGeminiWrapperSource({ homeDir }) {
  return `const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");

const env = { ...process.env, HOME: ${JSON.stringify(homeDir)}, CLIV_DEBUG: "1" };
delete env.CLIV_AGENT;
delete env.CODEX_THREAD_ID;
delete env.CLAUDE_SESSION_ID;
delete env.GEMINI_SESSION_ID;
delete env.CODEX_HOME;

fs.mkdirSync(env.HOME, { recursive: true });

const hook = spawnSync(${JSON.stringify(binaryPath)}, ["cache-gemini"], {
  env,
  input: JSON.stringify({
    prompt_response: "# Gemini PID Reply Fixture\\n\\nLoaded via real cache-gemini hook and pid-based GUI extraction.\\n",
  }),
  encoding: "utf8",
  stdio: ["pipe", "inherit", "inherit"],
});

if (hook.status !== 0) {
  process.exit(hook.status ?? 1);
}

const child = spawn(${JSON.stringify(binaryPath)}, process.argv.slice(2), {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
`;
}

function buildTrustedCallerWrapperSource({ homeDir }) {
  return `const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const env = { ...process.env, HOME: ${JSON.stringify(homeDir)}, CLIV_DEBUG: "1" };
delete env.CLIV_AGENT;
delete env.CODEX_THREAD_ID;
delete env.CLAUDE_SESSION_ID;
delete env.GEMINI_SESSION_ID;
delete env.CODEX_HOME;

const configDir = path.join(env.HOME, ".cliv");
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(
  path.join(configDir, "config.toml"),
  [
    "[launch]",
    'trusted_callers = ["mycli"]',
    "",
  ].join("\\n"),
  "utf8",
);

const child = spawn(${JSON.stringify(binaryPath)}, process.argv.slice(2), {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
`;
}

function closeTauriDriver() {
  exit = true;
  tauriDriver?.kill();
}

function resolveTauriDriver() {
  const candidates = [
    process.env.TAURI_DRIVER_PATH,
    driverExecutable,
    path.resolve(os.homedir(), ".cargo", "bin", driverExecutable),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === driverExecutable) {
      return candidate;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate ${driverExecutable}. Set TAURI_DRIVER_PATH or install it with cargo install tauri-driver.`,
  );
}

function resolveNativeDriverArgs() {
  const nativeDriverPath = resolveNativeDriverPath();

  if (!nativeDriverPath && os.platform() === "linux") {
    throw new Error(
      "Unable to locate WebKitWebDriver. Install webkit2gtk-driver or set CLIV_WEBKIT_WEBDRIVER_PATH.",
    );
  }

  return nativeDriverPath ? ["--native-driver", nativeDriverPath] : [];
}

function resolveNativeDriverPath() {
  if (os.platform() !== "linux") {
    return null;
  }

  const pathFromWhich = spawnSync("which", ["WebKitWebDriver"], {
    encoding: "utf8",
    shell: false,
  });
  const resolvedFromPath = pathFromWhich.status === 0 ? pathFromWhich.stdout.trim() : "";

  const candidates = [
    process.env.CLIV_WEBKIT_WEBDRIVER_PATH,
    resolvedFromPath,
    "/usr/bin/WebKitWebDriver",
    "/usr/libexec/webkit2gtk-4.1/WebKitWebDriver",
    "/usr/libexec/webkit2gtk-4.0/WebKitWebDriver",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function onShutdown(fn) {
  const cleanup = () => {
    fn();
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
  process.on("SIGBREAK", cleanup);
}

onShutdown(() => {
  closeTauriDriver();
});
