import { expect, test } from "@playwright/test";
import { uploadedMarkdown } from "./fixtures";
import { gotoApp, selectTextInViewer, uploadMarkdown } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          (window as Window & { __copiedText?: string }).__copiedText = value;
        },
      },
      configurable: true,
    });
  });
});

test("creates, edits, and submits annotations in browser mode", async ({ page }) => {
  await gotoApp(page);
  await uploadMarkdown(page, uploadedMarkdown, "annotations-fixture.md");
  await expect(page.getByRole("heading", { name: "E2E Fixture Document" })).toBeVisible();

  await selectTextInViewer(page, "This paragraph is used for browser upload tests and annotation coverage.");
  await expect(page.getByTestId("annotation-popup")).toHaveAttribute("data-mode", "create");

  await page.getByTestId("annotation-popup-kind-question").click();
  await page.getByTestId("annotation-popup-textarea").fill("Should we document edge cases?");
  await page.getByTestId("annotation-popup-submit").click();

  await expect(page.getByTestId("annotation-card")).toContainText("Should we document edge cases?");
  await expect(page.getByTestId("return-annotation-row")).toContainText("Should we document edge cases?");

  await page.getByTestId("annotation-card-edit").click();
  await expect(page.getByTestId("annotation-popup")).toHaveAttribute("data-mode", "edit");
  await page.getByTestId("annotation-popup-textarea").fill("Please clarify the rendering guarantees.");
  await page.getByTestId("annotation-popup-submit").click();

  await expect(page.getByTestId("annotation-card")).toContainText("Please clarify the rendering guarantees.");

  await page.getByTestId("return-template-iterate").click();
  await page.getByTestId("return-free-edit").fill("Focus on the annotation below.");
  await page.getByTestId("return-submit").click();

  await expect(page.getByTestId("return-status-success")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText ?? "")).toContain("Focus on the annotation below.");
  await expect.poll(async () => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText ?? "")).toContain("Please clarify the rendering guarantees.");
});
