import { expect, type Locator, type Page } from "@playwright/test";

export async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("topbar")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("left-sidebar")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("markdown-viewer")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("return-builder")).toBeVisible({ timeout: 30_000 });
}

export async function uploadMarkdown(page: Page, content: string, name = "fixture.md") {
  await page.getByTestId("browser-file-input").setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from(content, "utf-8"),
  });
}

export async function openDocumentSearch(page: Page) {
  await page.keyboard.press("Control+f");
  const search = page.getByTestId("document-search");
  await expect(search).toBeVisible();
  return search;
}

export async function selectTextInViewer(page: Page, exactText: string) {
  await page.locator("[data-testid='markdown-viewer']").evaluate((viewer, targetText) => {
    const walker = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const text = node.textContent ?? "";
      const start = text.indexOf(targetText);
      if (start === -1) continue;

      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + targetText.length);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      return;
    }

    throw new Error(`Unable to find text in markdown viewer: ${targetText}`);
  }, exactText);

  await page.mouse.up();
  await expect(page.getByTestId("annotation-popup")).toBeVisible();
}

export async function annotationRows(page: Page): Promise<Locator> {
  return page.getByTestId("return-annotation-row");
}
