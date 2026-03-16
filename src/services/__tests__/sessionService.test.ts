import { describe, it, expect, beforeEach } from "vitest";
import {
  createSession,
  listSessions,
  loadSession,
  deleteSession,
  saveAnnotations,
  saveReturn,
} from "@/services/sessionService";
import type { Annotation, ReturnBatch } from "@/types";

// Use fresh localStorage for each test
beforeEach(() => {
  localStorage.clear();
});

function makeAnnotation(id: string): Annotation {
  return {
    id,
    documentId: "doc-1",
    quote: "test quote",
    comment: "test comment",
    kind: "comment",
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

function makeReturnBatch(id: string): ReturnBatch {
  return {
    id,
    annotationIds: ["a1"],
    prompt: "test prompt",
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}

describe("sessionService", () => {
  describe("createSession", () => {
    it("should create a session with correct fields", () => {
      const session = createSession("Test Session", "/path/doc.md", [], []);
      expect(session.id).toMatch(/^sess_/);
      expect(session.name).toBe("Test Session");
      expect(session.documentPath).toBe("/path/doc.md");
      expect(session.annotations).toEqual([]);
      expect(session.returns).toEqual([]);
      expect(session.createdAt).toBeTruthy();
      expect(session.updatedAt).toBeTruthy();
    });

    it("should persist the session to localStorage", () => {
      createSession("Test", null, [], []);
      const sessions = listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe("Test");
    });

    it("should include annotations in the persisted session", () => {
      const ann = makeAnnotation("a1");
      const session = createSession("With Annotation", null, [ann], []);
      const loaded = loadSession(session.id);
      expect(loaded?.annotations).toHaveLength(1);
      expect(loaded?.annotations[0].id).toBe("a1");
    });
  });

  describe("listSessions", () => {
    it("should return empty array when no sessions exist", () => {
      expect(listSessions()).toEqual([]);
    });

    it("should return all sessions sorted by updatedAt descending", () => {
      createSession("First", null, [], []);
      createSession("Second", null, [], []);
      const sessions = listSessions();
      expect(sessions).toHaveLength(2);
      // Both sessions should be present
      const names = sessions.map((s) => s.name);
      expect(names).toContain("First");
      expect(names).toContain("Second");
    });

    it("should return summaries with annotation counts", () => {
      createSession("Test", null, [makeAnnotation("a1"), makeAnnotation("a2")], []);
      const sessions = listSessions();
      expect(sessions[0].annotationCount).toBe(2);
      expect(sessions[0].returnCount).toBe(0);
    });
  });

  describe("loadSession", () => {
    it("should return null for non-existent session", () => {
      expect(loadSession("non-existent")).toBeNull();
    });

    it("should return the full session record", () => {
      const created = createSession("Test", "/path", [makeAnnotation("a1")], []);
      const loaded = loadSession(created.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe("Test");
      expect(loaded?.annotations).toHaveLength(1);
    });
  });

  describe("deleteSession", () => {
    it("should remove the session", () => {
      const session = createSession("To Delete", null, [], []);
      expect(listSessions()).toHaveLength(1);
      deleteSession(session.id);
      expect(listSessions()).toHaveLength(0);
    });

    it("should not affect other sessions", () => {
      createSession("Keep", null, [], []);
      const s2 = createSession("Delete", null, [], []);
      deleteSession(s2.id);
      const remaining = listSessions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe("Keep");
    });
  });

  describe("saveAnnotations", () => {
    it("should update annotations for existing session", () => {
      const session = createSession("Test", null, [], []);
      saveAnnotations(session.id, [makeAnnotation("new-ann")]);
      const loaded = loadSession(session.id);
      expect(loaded?.annotations).toHaveLength(1);
      expect(loaded?.annotations[0].id).toBe("new-ann");
    });

    it("should set a valid updatedAt after saving annotations", () => {
      const session = createSession("Test", null, [], []);
      saveAnnotations(session.id, [makeAnnotation("a1")]);
      const loaded = loadSession(session.id);
      // updatedAt should be a valid ISO date string
      expect(loaded?.updatedAt).toBeTruthy();
      expect(new Date(loaded!.updatedAt).getTime()).not.toBeNaN();
      // Annotations should be updated
      expect(loaded?.annotations).toHaveLength(1);
    });

    it("should silently ignore non-existent session", () => {
      // Should not throw
      saveAnnotations("non-existent", [makeAnnotation("a1")]);
    });
  });

  describe("saveReturn", () => {
    it("should append a return batch to the session", () => {
      const session = createSession("Test", null, [], []);
      saveReturn(session.id, makeReturnBatch("r1"));
      saveReturn(session.id, makeReturnBatch("r2"));
      const loaded = loadSession(session.id);
      expect(loaded?.returns).toHaveLength(2);
    });
  });
});
