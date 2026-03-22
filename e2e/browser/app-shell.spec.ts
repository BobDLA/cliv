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
  await expect(page.getByTestId("topbar").getByText("cliV", { exact: true })).toBeVisible();
  await expect(page.getByTestId("topbar").getByText("v0.2")).toBeVisible();
  await expect(page.getByTestId("topbar-open-file")).toBeVisible();
  await expect(page.getByTestId("topbar-settings-toggle")).toBeVisible();
  await expect(page.getByTestId("topbar-github-link")).toBeVisible();
});

test("supports search, locale, theme, settings, and browser upload", async ({ page }) => {
  await gotoApp(page);

  await page.getByTestId("topbar-settings-toggle").click();
  await expect(page.getByTestId("personalization-panel")).toBeVisible();

  const fontSize = page.getByTestId("settings-font-controls");
  await expect(fontSize).toHaveText("18px");
  await page.getByLabel("Increase font size").click();
  await expect(fontSize).toHaveText("19px");
  await page.getByLabel("Decrease font size").click();
  await expect(fontSize).toHaveText("18px");

  await page.getByTestId("theme-option-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-option-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByTestId("settings-locale-zh").click();
  await expect(page.getByRole("heading", { name: "为什么用 cliV" })).toBeVisible();
  const search = await openDocumentSearch(page);
  await expect(search.getByRole("textbox")).toHaveAttribute("placeholder", "搜索文档...");
  await search.getByRole("textbox").fill("工作流");
  await expect(search).toContainText(/1\/\d+/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("document-search")).toHaveCount(0);
  await page.getByTestId("settings-locale-en").click();

  await uploadMarkdown(page, uploadedMarkdown, "uploaded-fixture.md");
  await expect(page.getByRole("heading", { name: "E2E Fixture Document" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uploaded Section" })).toBeVisible();
});
