# Session And History Boundary

日期：2026-03-23

## Purpose

This note defines the current boundary between saved sessions and archived history replay in cliV.
It is a long-lived architecture reference for Type B refactors that preserve the existing product contract while changing how review snapshots are restored.

## Stable Contract

- Saved sessions remain local-only and open as editable review state.
- Archived history entries remain filesystem-backed and open as read-only replay state.
- Existing `localStorage` session data stays readable without migration.
- Opening a saved session or archived replay continues to restore document and annotation context into the current review UI.

## Persistence Sources

| Source | Backing store | Owner | Restore mode |
| --- | --- | --- | --- |
| Saved session | browser `localStorage` key `cliv-sessions` | `sessionService` | editable |
| Archived review | `~/.cliv/history/archive/` | Tauri history commands + `historyService` | read-only replay |

These two sources intentionally coexist for now. The history archive is not a transparent replacement for saved sessions, and this refactor does not migrate or merge the data models.

## Restore Boundary

Review snapshot application is centralized in `src/services/reviewSnapshot.ts`.

That module is responsible for:

- mapping a saved session into a document + annotation snapshot
- mapping an archived review into a replay snapshot
- applying the snapshot to the active stores in one place

The restore seam keeps the current product behavior explicit:

- session restore updates annotations and document metadata, and keeps the session editable
- archive replay additionally resets selection / return state and marks the document read-only

## Current Flow

1. `sessionService` owns local session persistence and summary derivation.
2. `SessionTree` loads a saved session, asks `reviewSnapshot` to build an editable snapshot, then applies it.
3. `historyService` loads archive data from Tauri.
4. `historyStore` asks `reviewSnapshot` to build a replay snapshot, then applies it.

This keeps store mutation policy shared without collapsing the distinct persistence models into one abstraction too early.
