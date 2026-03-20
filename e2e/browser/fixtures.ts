import type { Annotation } from "../../src/types";

export const uploadedMarkdown = `# E2E Fixture Document

## Uploaded Section

This paragraph is used for browser upload tests and annotation coverage.

### Search Target

Playwright can search this document and verify the result counter.
`;

export const sessionAnnotation: Annotation = {
  id: "ann-session-1",
  documentId: "demo",
  quote: "The quoted text from the saved session",
  comment: "Saved annotation restored from session history",
  range: {
    startOffset: 10,
    endOffset: 42,
    contextSnippet: "The quoted text from the saved session",
  },
  kind: "comment",
  status: "open",
  createdAt: "2026-03-19T09:00:00.000Z",
};

export const seedSessionRecord = {
  id: "sess_e2e_saved",
  name: "E2E Saved Session",
  documentPath: "/tmp/e2e-compose.md",
  createdAt: "2026-03-19T09:00:00.000Z",
  updatedAt: "2026-03-19T09:00:00.000Z",
  annotations: [sessionAnnotation],
  returns: [],
};
