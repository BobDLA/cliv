## 1. Backend Launch Resolution

- [x] 1.1 Add backend config loading with defaults for trusted callers, ignored callers, scan depth, and prompt-template overrides.
- [x] 1.2 Refactor CLI parsing and file-load payloads to separate review paths from write target paths, including explicit target flags and trusted-caller positional fallback.
- [x] 1.3 Tighten trusted-caller detection to canonical exact matching on the first non-wrapper caller only.

## 2. Frontend State And Write-Back

- [x] 2.1 Update frontend document/session state so reviewed files and write targets are tracked separately, and only write targets enable file write-back.
- [x] 2.2 Load prompt-template overrides from backend config and apply them in prompt generation and default ReturnBuilder headers.

## 3. Verification And Docs

- [x] 3.1 Add focused tests for standalone review mode, explicit target mode, strict trusted caller fallback, and config-driven prompt overrides.
- [x] 3.2 Update user-facing docs to describe the new launch semantics, compatibility alias, and `~/.cliv/config.toml` format.
