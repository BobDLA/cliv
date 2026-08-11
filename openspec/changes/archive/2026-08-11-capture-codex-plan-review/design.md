## Context

cliV currently captures Codex replies only from the `notify` command configured in `~/.codex/config.toml`. Codex Plan Review can produce both notify and Stop events with null assistant-message fields. The completed plan is persisted in the session transcript as an `item_completed` event whose item type is `Plan`, keyed by the same session and turn ids. cliV already uses PID-keyed cache files plus metadata to keep concurrent agent sessions isolated.

## Goals / Non-Goals

**Goals:**

- Capture the current Codex plan before cliV is opened as the Plan Review editor.
- Preserve the existing notify command and cache lookup contract.
- Keep cache writes atomic and scoped to the originating Codex process.
- Prevent hook payload content from being copied into cliV logs.
- Give users accurate setup and trust instructions without taking ownership of Codex configuration.

**Non-Goals:**

- Running or attaching to Codex App Server.
- Automatically editing `~/.codex/config.toml` or `~/.codex/hooks.json`.
- Changing annotation or write-back behavior after content reaches the document store.

## Decisions

1. **Use one backward-compatible command with two transports.** `cliv cache-codex <json>` continues to parse notify input. `cliv cache-codex` reads a `Stop` payload from stdin. A new subcommand would duplicate cache behavior and make installation guidance harder to maintain.
2. **Normalize event schemas before writing.** Accepted notify and Stop payloads become one internal record containing session id, message, turn id, permission mode, and source. When a Stop message is empty, inspect only its declared transcript path and accept only an exact same-session, same-turn `item_completed/Plan` item. Unknown events or missing required content are logged without writing cache data.
3. **Accept every Stop response.** Plan mode is identified for diagnostics by `permission_mode: "plan"`, but Stop capture is not filtered to that mode. This makes the lifecycle hook a resilient primary source while notify remains compatible; duplicate successful events are harmless because they contain the same current assistant reply and use atomic replacement.
4. **Remove only an exact outer plan envelope.** When the complete trimmed response is enclosed by `<proposed_plan>` and `</proposed_plan>`, cache the enclosed Markdown. Embedded tags, code examples, and ordinary replies remain unchanged.
5. **Retain PID/session isolation with token-aware process matching.** Both sources use the current Codex ancestor identity and the existing metadata resolution. Agent discovery matches exact or `agent-*` path components within process names and command-line tokens, not arbitrary substrings, so Node package paths remain detectable while a workspace containing `codex` cannot steal cache ownership. A later accepted response from the same Codex process replaces the prior reply, so Plan Review cannot intentionally fall back to an earlier turn.
6. **Redact before logging argv.** Cache subcommand diagnostics record command shape and payload length, never the JSON argument itself. stdin continues to be represented only by length and parsed field metadata.
7. **Document a user-level Stop hook.** The canonical configuration keeps notify in `config.toml` and adds `Stop -> cliv cache-codex` in `hooks.json`, followed by review through `/hooks`. Users with inline hooks merge the handler there instead of configuring both hook representations.

## Risks / Trade-offs

- **Hook unavailable, disabled, or untrusted** → notify remains supported; documentation and the Integrations UI explain hook trust and troubleshooting.
- **Notify and Stop race** → both normalize to atomic writes for the same PID and normally carry identical content; null notify payloads do not replace valid Stop content.
- **Codex changes hook or transcript fields** → reject unknown or incomplete payloads without scanning unrelated sessions; strict session/turn/item matching and regression fixtures prevent cross-talk.
- **Plan envelope rules change** → exact-envelope stripping fails safe by preserving non-matching content.

## Migration Plan

Ship the dual-input command without changing existing installations. Users who need Plan Review capture add and trust the Stop hook; rollback consists of removing that hook while notify continues to work. No cache migration or dependency change is required.

## Open Questions

None.
