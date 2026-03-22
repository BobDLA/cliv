import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });
  });
});

test("shows empty archive history in browser mode", async ({ page }) => {
  await gotoApp(page);

  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("history-tree-empty")).toBeVisible();
  await expect(page.getByTestId("history-tree")).toHaveCount(0);
  await expect(page.getByText("No archived reviews yet")).toBeVisible();
});

test("allows switching the sidebar default tab from settings", async ({ page }) => {
  await gotoApp(page);

  await page.getByTestId("topbar-settings-toggle").click();
  await page.getByTestId("settings-tab-layout").click();
  await page.getByTestId("settings-sidebar-tab-history").click();

  await expect(page.getByTestId("history-tree-empty")).toBeVisible();
  await expect(page.getByTestId("document-outline")).toHaveCount(0);

  await page.getByTestId("sidebar-tab-outline").click();
  await expect(page.getByTestId("document-outline")).toBeVisible();
});
