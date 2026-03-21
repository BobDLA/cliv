# AGENTS.md

This file provides context for AI coding agents working on this codebase.

## Project Overview

**cliV** is a desktop GUI application for reviewing long AI agent replies. It's built with:

- **Frontend**: React 19 + Vite 7 + Zustand (state) + TailwindCSS 4
- **Backend**: Tauri v2 (Rust) — handles CLI parsing, file I/O, and agent reply extraction
- **Scripts**: Python cache scripts + Bash wrapper for `$EDITOR` integration
- works on multiple platforms: Linux, macOS, Windows

## Architecture

```text
src/                    # React frontend
├── app/                # App shell, hooks, components
├── features/           # Feature modules (documents, annotations, return, sessions)
├── services/           # Tauri IPC, writeBack, sessionService
├── stores/             # Zustand stores
└── types/              # TypeScript types

src-tauri/              # Rust backend
├── src/
│   ├── cli.rs          # CLI argument parsing + subcommand routing
│   ├── cache.rs        # Agent reply caching
│   ├── lib.rs          # Tauri app setup + command registration
│   ├── main.rs         # Entry point: cache subcommands or GUI
│   ├── commands/       # Tauri IPC commands
│   └── extract/        # Agent reply extractors
└── tauri.conf.json     # Tauri configuration
```

## Key Patterns

- **Agent detection**: `CLIV_AGENT` env var set by wrapper, read by Rust CLI parser
- **Reply extraction**: Cascading fallback (cache → transcript → scan), agent-aware priority
- **Atomic writes**: All file writes use write-to-tmp + rename pattern
- **State management**: Zustand with localStorage persistence (prefix: `cliv:`)
- **User data**: Stored in `~/.cliv/` (sessions, annotations)
- **Write-back fallback**: when no explicit write target exists, output falls back to clipboard

## Development

```bash
pnpm install          # Install dependencies
pnpm tauri:dev        # Dev mode (hot reload)
pnpm test             # Run Vitest suite
pnpm lint             # Lint frontend code
pnpm typecheck        # TypeScript typecheck
pnpm tauri:build      # Production build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Testing & Validation

See also:
- `docs/testing-standard.md`
- `docs/regression-cases.md`

### Change type → minimum validation

#### Frontend UI / interaction
Applies to:
- `src/app/**`
- `src/features/**`
- `src/styles/**`

Minimum:
- run relevant targeted `pnpm test -- <file>` checks
- if fixing an interaction bug, add or update a regression test
- if the change is visual-only and not yet practical to automate, document manual verification points

#### Service / store / prompt / write-back behavior
Applies to:
- `src/services/**`
- `src/stores/**`
- `src/lib/promptTemplates.ts`

Minimum:
- run the related service / store tests
- if behavior crosses frontend/backend boundaries, note the integration check you performed

#### Rust CLI / config / launch semantics
Applies to:
- `src-tauri/src/cli.rs`
- `src-tauri/src/config.rs`
- `src-tauri/src/commands/**`

Minimum:

```bash
cargo test --manifest-path src-tauri/Cargo.toml cli::tests
cargo test --manifest-path src-tauri/Cargo.toml config::tests
```

Run the full Rust suite when the change crosses multiple backend paths.

#### Docs / integration behavior
Applies to:
- `README.md`
- `README.zh-CN.md`
- `docs/install-guide*.md`
- `docs/integrations*.md`

Minimum:
- examples, flags, config keys, and paths must match the current implementation
- sync both Chinese and English docs when public behavior changes

#### OpenSpec changes
Applies to:
- `openspec/changes/**`

Minimum closeout order:
1. verify
2. sync
3. archive

When a change is complete, prefer committing the archived change and synced main specs together with the implementation.

## Bug Fix Rule

If a bug is reproducible, prefer adding automated regression protection.

At minimum, every bug fix should leave behind one of:
- an automated regression test, or
- a named manual regression case in `docs/regression-cases.md` with a clear reason it is not yet automated

## Closeout Checklist

Before considering work complete:
- run the minimum validation for the changed area
- update docs if user-visible behavior changed
- sync OpenSpec artifacts if the change affects stable behavior or contracts
- keep temporary scratch files out of commits (`temp/` is ignored)
- record what you ran and what you did not run

Recommended format:

```md
## Validation

### Ran
- pnpm test -- src/features/annotations/__tests__/annotationFlow.test.tsx
- cargo test --manifest-path src-tauri/Cargo.toml cli::tests

### Not run
- pnpm test:e2e
  - reason: this change only touched CLI/config parsing
```

## Documentation Sync Rules

If you change public behavior, check whether these also need updates:
- `README.md`
- `README.zh-CN.md`
- `docs/install-guide.md`
- `docs/install-guide.zh-CN.md`
- `docs/integrations.md`
- `docs/integrations.zh-CN.md`
- demo copy or examples under `src/app/demoContent.ts` and `docs/demo/demo.md`

## Notes for Agents

- Prefer small, focused changes over broad refactors.
- Do not introduce new abstractions unless they clearly reduce repeated complexity.
- When OpenSpec already covers the behavior change, use the existing OpenSpec workflow instead of inventing a parallel artifact system.
- Keep explanations and validation evidence concise and specific.
