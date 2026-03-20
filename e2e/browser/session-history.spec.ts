import { expect, test } from "@playwright/test";
import { gotoApp, seedSavedSession } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });
  });
  await seedSavedSession(page);
});

test("shows saved session history and restores annotations", async ({ page }) => {
  await gotoApp(page);

  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("session-tree")).toBeVisible();
  await expect(page.getByTestId("session-item")).toContainText("E2E Saved Session");

  await page.getByTestId("session-item").click();
  await expect(page.getByTestId("return-annotation-row")).toContainText("Saved annotation restored from session history");
  await expect(page.getByTestId("return-select-all")).toBeVisible();
});


test("deletes a saved session from history", async ({ page }) => {
  await gotoApp(page);

  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("session-item")).toHaveCount(1);
  await page.getByTestId("session-delete").click();
  await expect(page.getByTestId("session-tree-empty")).toBeVisible();
});
