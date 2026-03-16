/**
 * Generate a unique ID for annotations and other entities.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Clamp a number between min and max inclusive.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the plain-text selection offsets relative to a container element.
 * Used for anchoring annotations to document positions.
 */
export function getSelectionOffsets(
  container: HTMLElement,
  range: Range,
): { startOffset: number; endOffset: number; contextSnippet?: string } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  let startOffset = -1;
  let endOffset = -1;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = (node.textContent || "").length;

    if (node === range.startContainer) {
      startOffset = charCount + range.startOffset;
    }
    if (node === range.endContainer) {
      endOffset = charCount + range.endOffset;
      break;
    }

    charCount += len;
  }

  if (startOffset === -1 || endOffset === -1) return null;

  // Extract context snippet (surrounding text for re-anchoring)
  const fullText = container.textContent || "";
  const snippetStart = Math.max(0, startOffset - 30);
  const snippetEnd = Math.min(fullText.length, endOffset + 30);
  const contextSnippet = fullText.slice(snippetStart, snippetEnd);

  return { startOffset, endOffset, contextSnippet };
}
