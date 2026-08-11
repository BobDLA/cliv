## Why

Codex Plan Review can emit an `agent-turn-complete` notification whose `last-assistant-message` is null, so cliV's notify-only capture path has no plan content to display when Codex opens cliV as `$EDITOR`. Plan review is a high-value review point and must reliably show the current plan rather than an empty or previous reply.

## What Changes

- Extend `cliv cache-codex` to accept both the existing notify JSON argument and Codex `Stop` hook JSON on stdin.
- Normalize both event shapes into the existing PID-isolated reply cache and render an outer `<proposed_plan>` envelope as normal Markdown content.
- Keep the existing notify integration for compatibility while documenting the `Stop` hook as the Plan Review capture path.
- Redact cache payloads from cliV command-line logging.
- Update the Integrations UI, bilingual integration/install/demo documentation, and regression coverage.

## Capabilities

### New Capabilities

- `agent-reply-capture`: Stable capture behavior for agent replies, including Codex notify and lifecycle-hook payloads used by Plan Review.

### Modified Capabilities

None.

## Impact

- Tauri/Rust CLI parsing, Codex cache ingestion, PID/session cache metadata flow, and diagnostic logging.
- Frontend Integrations guidance and its localized tests.
- Codex user configuration under `~/.codex/config.toml` and `~/.codex/hooks.json` remains user-owned and is documented rather than rewritten by cliV.
- Public documentation and manual regression guidance for Linux, macOS, and Windows.
