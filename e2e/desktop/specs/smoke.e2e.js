import fs from "fs";

const scenario = process.env.CLIV_DESKTOP_SCENARIO ?? "standalone";
const composePath = process.env.CLIV_DESKTOP_COMPOSE_PATH;
const expectedHeading = process.env.CLIV_DESKTOP_EXPECTED_HEADING;
const expectedError = process.env.CLIV_DESKTOP_EXPECTED_ERROR;
const originalContent = composePath ? fs.readFileSync(composePath, "utf8") : null;

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

  it("loads the document into the desktop app", async () => {
    const viewer = await $("[data-testid='markdown-viewer']");
    await viewer.waitForDisplayed({ timeout: 60000 });

    const heading = await $(`h1=${expectedHeading}`);
    await expect(await heading.isDisplayed()).toBe(true);

    const topbar = await $("[data-testid='topbar']");
    await expect(await topbar.isDisplayed()).toBe(true);
  });

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
