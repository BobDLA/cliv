## Context

The current startup flow uses one `compose_path` field for two different meanings:

- a file the user wants to read in standalone mode
- a file cliV is allowed to overwrite on write-back

That ambiguity leaks across the stack. The backend parser fills `compose_path` from the first positional argument, `load_files` falls back to rendering that file as reply content, and the frontend write-back button treats any `composePath` as a writable target. This is unsafe for default Markdown-reader usage and makes `$EDITOR` compatibility depend on every caller reliably passing extra flags.

The requested fix also needs configurability: trusted parent process names and prompt-template overrides should live in a user config file instead of being hard-coded.

## Goals / Non-Goals

**Goals:**

- Distinguish review content from write target content end-to-end.
- Keep explicit target flags available and unambiguous.
- Preserve legacy agent/editor launches that only pass a positional file by using trusted-caller detection.
- Make uncertain launches safe by degrading to review-only plus clipboard output.
- Allow user configuration of trusted caller names and prompt header templates without rebuilding the app.

**Non-Goals:**

- Full per-caller workflow scripting or per-project config precedence.
- Arbitrary prompt-template editing for every localized UI string.
- Reworking agent reply extraction itself.

## Decisions

### 1. Introduce explicit review and target fields

The backend will expose separate `review_path` and `target_path` values instead of overloading one field. The file-loading command will accept both and return reply content from `review_path` when present, while `target_path` will only be used to load editable target content and enable write-back.

Why:

- It removes the unsafe implicit coupling.
- It allows standalone review and agent write-back to coexist cleanly.

Alternative considered:

- Keep one field and add a boolean mode flag. Rejected because downstream code would still need to infer which meaning the path carries.

### 2. Keep `--compose` as a compatibility alias, but prefer `--target`

CLI parsing will support `--target <file>`, `-t <file>`, and `--compose <file>`. Internally they all map to `target_path`.

Why:

- `target` is clearer for new documentation.
- `--compose` avoids breaking existing documented/editor integrations immediately.

Alternative considered:

- Remove `--compose` now. Rejected because it would force simultaneous caller updates.

### 3. Trusted-caller fallback is separate from agent detection

Trusted launch detection will canonicalize process names, skip configured wrapper callers, and then inspect only the first non-wrapper caller. If that caller exactly matches a configured trusted caller and no explicit target flag is present, a lone positional file will be treated as `target_path`; otherwise it remains `review_path`.

Agent detection remains focused on picking the extraction source order and session ID behavior.

Why:

- Some caller names indicate a safe “editor callback” even when explicit flags are missing.
- The first non-wrapper caller is the clearest ownership boundary for trust.
- Exact canonical matching avoids substring-based false positives.

Alternative considered:

- Continue scanning all ancestors with substring matching. Rejected because it is too permissive for a safety-sensitive launch decision.

### 4. Load tolerant user config from `~/.cliv/config.toml`

The backend will load a config file if present, otherwise use defaults. Unknown or missing fields will fall back safely. The config will cover:

- `launch.scan_depth`
- `launch.trusted_callers`
- `launch.ignored_callers`
- `prompts.reply_header_zh`
- `prompts.reply_header_en`
- `prompts.iterate_header_zh`
- `prompts.iterate_header_en`

Why:

- Startup behavior and prompt headers are user policy, not compile-time constants.
- Missing config must not block launches.

Alternative considered:

- Store config in frontend localStorage. Rejected because trusted-caller resolution happens before the frontend starts.

### 5. Frontend write-back uses target state only

The ReturnBuilder submit flow, button state, and auto-close behavior will depend on `targetPath`, not on the reviewed file path. Session save/open flows will use the reviewed file path so standalone history restores the correct document.

Why:

- A reviewed file is not automatically a writable file.
- Saved history should reopen the document the user was annotating, not the target they might write into.

## Risks / Trade-offs

- [Config parsing failures] → Treat malformed or unreadable config as defaults and log the error.
- [Trusted-caller false positives] → Canonicalize process names, require exact match, and stop after the first non-wrapper caller.
- [Compatibility drift in docs vs behavior] → Keep `--compose` as an alias while documenting `--target` as the preferred term.
- [State refactor regressions] → Add focused tests for standalone review, explicit target mode, and trusted caller fallback.
