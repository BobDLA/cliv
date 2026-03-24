import fs from "fs";

const scenario = process.env.CLIV_DESKTOP_SCENARIO ?? "standalone";
const composePath = process.env.CLIV_DESKTOP_COMPOSE_PATH;
const expectedHeading = process.env.CLIV_DESKTOP_EXPECTED_HEADING;
const expectedError = process.env.CLIV_DESKTOP_EXPECTED_ERROR;
const logPath = process.env.CLIV_DESKTOP_LOG_PATH;
const originalContent = composePath ? fs.readFileSync(composePath, "utf8") : null;

async function describeVisibleState() {
  const topbar = await $("[data-testid='topbar']");
  const viewer = await $("[data-testid='markdown-viewer']");
  const errorView = await $("[data-testid='error-view']");
  const shell = await $("[data-testid='app-shell']");
  return {
    topbar: await topbar.isExisting(),
    viewer: await viewer.isExisting(),
    errorView: await errorView.isExisting(),
    shell: await shell.isExisting(),
    body: await browser.execute(() => document.body?.innerText ?? ""),
  };
}

function readLog() {
  if (!logPath || !fs.existsSync(logPath)) {
    return "";
  }
  return fs.readFileSync(logPath, "utf8");
}

describe(`cliV desktop smoke (${scenario})`, () => {
  after(() => {
    if (composePath && originalContent !== null && fs.existsSync(composePath)) {
      fs.writeFileSync(composePath, originalContent, "utf8");
    }
  });

  if (scenario === "missing-reply") {
    it("shows an error state when metadata reply is missing", async () => {
      const errorView = await $("[data-testid='error-view']");
      await errorView.waitForDisplayed({ timeout: 60000 });
      await expect(await errorView.isDisplayed()).toBe(true);

      const errorText = await errorView.getText();
      await expect(errorText.includes(expectedError)).toBe(true);
    });

    return;
  }

  if (scenario === "trusted-caller-only") {
    it("stays fail-closed for trusted-caller-only launches", async () => {
      const topbar = await $("[data-testid='topbar']");
      await topbar.waitForDisplayed({ timeout: 60000 });
      await expect(await topbar.isDisplayed()).toBe(true);

      await browser.waitUntil(
        () => {
          const log = readLog();
          return (
            log.includes('mode=gui  detected_agent=None trusted_caller=Some("mycli")') &&
            !log.includes("extract_gemini_reply: start") &&
            !log.includes("extract_claude_reply: start") &&
            !log.includes("extract_codex_reply: start")
          );
        },
        {
          timeout: 10000,
          interval: 250,
          timeoutMsg: "trusted-caller-only launch unexpectedly triggered extraction or missed trust detection",
        },
      );

      const viewer = await $("[data-testid='markdown-viewer']");
      await expect(await viewer.isExisting()).toBe(false);

      const errorView = await $("[data-testid='error-view']");
      await expect(await errorView.isExisting()).toBe(false);
    });

    return;
  }

  it("loads the document into the desktop app", async () => {
    const viewer = await $("[data-testid='markdown-viewer']");
    await viewer.waitForDisplayed({ timeout: 60000 });

    const heading = await $(`h1=${expectedHeading}`);
    await expect(await heading.isDisplayed()).toBe(true);

    const topbar = await $("[data-testid='topbar']");
    await expect(await topbar.isDisplayed()).toBe(true);
  });

  if (scenario === "gemini-pid-only") {
    it("extracts only the detected Gemini reply from pid cache", async () => {
      await browser.waitUntil(
        () => {
          const log = readLog();
          return log.includes('mode=gui  detected_agent=Some("gemini")');
        },
        {
          timeout: 10000,
          interval: 250,
          timeoutMsg: "gemini pid-only scenario never detected Gemini agent",
        },
      );

      const state = await describeVisibleState();
      const log = readLog();

      if (!state.viewer) {
        throw new Error(
          [
            "gemini pid-only viewer did not render",
            `state=${JSON.stringify(state)}`,
            `log=${log}`,
          ].join("\n\n"),
        );
      }

      const heading = await $(`h1=${expectedHeading}`);
      await expect(await heading.isDisplayed()).toBe(true);

      await expect(log.includes("extract_claude_reply: start")).toBe(false);
      await expect(log.includes("extract_codex_reply: start")).toBe(false);
    });

    return;
  }

  if (scenario === "standalone") {
    it("writes generated content back to the compose file", async () => {
      const submit = await $("[data-testid='return-submit']");
      await submit.waitForDisplayed({ timeout: 60000 });
      await expect(await submit.isEnabled()).toBe(true);
      await submit.click();

      await browser.waitUntil(
        () => {
          const content = fs.readFileSync(composePath, "utf8");
          return content !== originalContent;
        },
        {
          timeout: 10000,
          interval: 250,
          timeoutMsg: "compose fixture was not updated by write-back",
        },
      );
    });
  }
});
