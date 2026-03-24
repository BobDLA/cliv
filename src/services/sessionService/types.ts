import type { Annotation, ReturnBatch } from "@/types";

export interface SessionRecord {
  id: string;
  name: string;
  documentPath: string | null;
  createdAt: string;
  updatedAt: string;
  annotations: Annotation[];
  returns: ReturnBatch[];
}

export interface SessionSummary {
  id: string;
  name: string;
  documentPath: string | null;
  createdAt: string;
  updatedAt: string;
  annotationCount: number;
  returnCount: number;
}

export const SESSION_STORAGE_KEY = "cliv-sessions";
