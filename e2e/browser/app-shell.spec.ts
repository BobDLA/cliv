import { expect, test } from "@playwright/test";
import { gotoApp, openDocumentSearch, uploadMarkdown } from "./helpers";
import { uploadedMarkdown } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });
  });
});

test("renders demo document and top-level controls", async ({ page }) => {
  await gotoApp(page);

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("left-sidebar")).toBeVisible();
  await expect(page.getByTestId("markdown-viewer")).toBeVisible();
  await expect(page.getByTestId("return-builder")).toBeVisible();
  await expect(page.getByTestId("document-outline")).toBeVisible();
  await expect(page.getByRole("heading", { name: "cliV v0.2" })).toBeVisible();
  await expect(page.getByTestId("topbar-open-file")).toBeVisible();
});

test("supports search, locale, theme, zoom, fullscreen, and browser upload", async ({ page }) => {
  await gotoApp(page);

  const fontSize = page.getByTestId("topbar-font-size");
  await expect(fontSize).toHaveText("18");
  await page.getByTestId("topbar-zoom-in").click();
  await expect(fontSize).toHaveText("19");
  await page.getByTestId("topbar-zoom-out").click();
  await expect(fontSize).toHaveText("18");

  await page.getByTestId("theme-option-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-option-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByTestId("topbar-locale-toggle").click();
  const search = await openDocumentSearch(page);
  await expect(search.getByRole("textbox")).toHaveAttribute("placeholder", "搜索文档...");
  await search.getByRole("textbox").fill("功能状态");
  await expect(search).toContainText(/1\/\d+/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("document-search")).toHaveCount(0);

  await uploadMarkdown(page, uploadedMarkdown, "uploaded-fixture.md");
  await expect(page.getByRole("heading", { name: "E2E Fixture Document" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uploaded Section" })).toBeVisible();

  await page.getByTestId("topbar-fullscreen-toggle").click();
  await expect(page.getByTestId("fullscreen-view")).toBeVisible();
  await page.getByTestId("fullscreen-exit").click();
  await expect(page.getByTestId("fullscreen-view")).toHaveCount(0);
});
