## 1. Codex capture implementation

- [x] 1.1 Extend `cliv cache-codex` to preserve notify arguments, read Stop-hook JSON from stdin, recover a null-message Plan from the exact same session/turn transcript item, and strip only an exact outer proposed-plan envelope.
- [x] 1.2 Reuse PID/session cache isolation for both sources and redact cache payloads from CLI invocation logs.

## 2. Automated regression protection

- [x] 2.1 Add Rust unit coverage for notify, Stop, real null-message Plan transcript fallback, invalid/empty payloads, exact turn isolation, envelope normalization, and argv redaction.
- [x] 2.2 Add a binary integration regression that simulates a Codex ancestor, writes an ordinary reply followed by the real null-message Plan event shape, and proves current-plan extraction from the same PID.

## 3. User-facing integration guidance

- [x] 3.1 Update localized Integrations settings copy and frontend tests to show the Codex `config.toml` plus `hooks.json` boundary and hook-trust requirement.
- [x] 3.2 Synchronize English and Chinese install, integration, and demo documentation for dual notify/Stop configuration, platform paths, verification, and troubleshooting.
- [x] 3.3 Add a named Codex Plan Review manual regression case with `Manual verification:` and the reason the real Codex UI boundary is not fully automated.

## 4. Validation and closeout

- [x] 4.1 Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [x] 4.2 Run the targeted Integrations frontend test, `pnpm typecheck`, and `pnpm test:docs`; record any environment-limited validation.
