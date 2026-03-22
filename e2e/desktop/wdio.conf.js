import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const binaryPath = path.join(
  repoRoot,
  "src-tauri",
  "target",
  "debug",
  os.platform() === "win32" ? "cliv.exe" : "cliv",
);
const driverExecutable =
  os.platform() === "win32" ? "tauri-driver.exe" : "tauri-driver";
const desktopScenario = process.env.CLIV_DESKTOP_SCENARIO ?? "standalone";
const scenarioWorkspace = ensureScenarioWorkspace(desktopScenario);
const appArgs = buildAppArgs(scenarioWorkspace);

process.env.CLIV_DESKTOP_WORKSPACE = scenarioWorkspace.workspaceDir;
process.env.CLIV_DESKTOP_COMPOSE_PATH = scenarioWorkspace.composePath ?? "";
process.env.CLIV_DESKTOP_REPLY_PATH = scenarioWorkspace.replyPath ?? "";
process.env.CLIV_DESKTOP_METADATA_PATH = scenarioWorkspace.metadataPath ?? "";
process.env.CLIV_DESKTOP_EXPECTED_HEADING = scenarioWorkspace.expectedHeading ?? "";
process.env.CLIV_DESKTOP_EXPECTED_ERROR = scenarioWorkspace.expectedError ?? "";

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
        application: binaryPath,
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
    const result = spawnSync("pnpm", ["tauri", "build", "--debug", "--no-bundle"], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
    });

    if (result.status !== 0) {
      throw new Error("Failed to build Tauri debug app for desktop smoke tests");
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

function buildAppArgs(workspace) {
  if (workspace.metadataPath) {
    return ["--compose", workspace.composePath, "--metadata", workspace.metadataPath];
  }

  if (desktopScenario === "standalone") {
    return ["--compose", workspace.composePath, workspace.composePath];
  }

  return [workspace.composePath];
}

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
  };
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
