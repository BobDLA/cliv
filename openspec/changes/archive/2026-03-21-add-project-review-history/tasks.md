## 1. Archive Persistence

- [x] 1.1 Add Tauri-side archive models and commands for workspace-grouped history directories under `~/.cliv/history/archive/`.
- [x] 1.2 Capture normalized launch-time cwd as `workspace.path` and persist it in `workspace.json` and per-archive metadata.
- [x] 1.3 Update submit/write-back flow to create `meta.json`, `reply.md`, `annotations.json`, `submission.json`, and optional `target.before.md` only after a successful submit result.

## 2. History Browsing

- [x] 2.1 Replace or extend the current history data source so the History pane reads archive summaries from filesystem metadata instead of the localStorage session MVP.
- [x] 2.2 Render history entries grouped by workspace with summary text in the form of time, submitted character count, and `X条`, and add search over workspace/source metadata plus archived annotation content.
- [x] 2.3 Open archived reviews in a read-only replay mode that restores archived reply content, highlights, and comment cards within the existing three-column layout.

## 3. Validation And Docs

- [x] 3.1 Add or update tests for archive creation, failed-submit no-archive behavior, grouped history listing/search, and read-only archive replay.
- [x] 3.2 Update user-facing docs and demo content for the new history/archive behavior, and record the validation steps run for the change.
