## Why

cliV currently overloads a single positional file path as both the file to review and the file to write back to. That is unsafe for default Markdown-reader usage because `cliv file.md` can silently become a write target, and it is brittle for agent/editor integrations because not every caller can reliably inject extra CLI flags.

## What Changes

- Separate launch inputs into a review document path and an optional write target path.
- Add explicit target flags: `--target <file>`, `-t <file>`, and keep `--compose <file>` as a compatibility alias.
- Add stricter trusted-caller fallback rules so legacy `$EDITOR=cliv` integrations can still treat a lone positional file as the write target when the first non-wrapper caller is recognized exactly.
- Add a user config file at `~/.cliv/config.toml` for trusted caller names, ignored wrapper callers, scan depth, and prompt-template overrides.
- Make standalone `cliv <file.md>` launches safe by default: load the file for review, but do not treat it as a write target unless a trusted launch rule or explicit target flag says so.

## Capabilities

### New Capabilities
- `launch-context-target-resolution`: Resolve launch mode safely across standalone file opens, trusted agent/editor launches, explicit target flags, and config-driven caller matching.

### Modified Capabilities
- None.

## Impact

- Rust CLI parsing and parent-process detection in `src-tauri/src/cli.rs`
- New configuration loading module under `src-tauri/src/`
- Tauri file-loading command payloads in `src-tauri/src/commands/files.rs`
- Frontend document state, session save/open behavior, and write-back logic in `src/`
- Prompt-template resolution in the frontend
- User docs for launch semantics and configuration
