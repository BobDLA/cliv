# AGENTS.md

This file provides context for AI coding agents working on this codebase.

## Project Overview

**cliV** is a desktop GUI application for reviewing long AI agent replies. It's built with:

- **Frontend**: React 19 + Vite 7 + Zustand (state) + TailwindCSS 4
- **Backend**: Tauri v2 (Rust) — handles CLI parsing, file I/O, and agent reply extraction
- **Scripts**: Python cache scripts + Bash wrapper for `$EDITOR` integration

## Architecture

```
src/                    # React frontend
├── app/                # App shell, hooks, components
├── features/           # Feature modules (documents, annotations, return, sessions)
├── services/           # Tauri IPC, writeBack, sessionService
├── stores/             # Zustand stores (6 stores)
└── types/              # TypeScript types

src-tauri/              # Rust backend
├── src/
│   ├── cli.rs          # CLI argument parsing + subcommand routing
│   ├── cache.rs        # Agent reply caching (replaces Python scripts)
│   ├── lib.rs          # Tauri app setup + command registration
│   ├── main.rs         # Entry point: cache subcommands or GUI
│   ├── commands/       # Tauri IPC commands (files.rs, sessions.rs)
│   └── extract/        # Agent reply extractors (codex.rs, claude.rs, gemini.rs)
└── tauri.conf.json     # Tauri configuration
```

## Key Patterns

- **Agent detection**: `CLIV_AGENT` env var set by wrapper, read by Rust CLI parser
- **Reply extraction**: Cascading fallback (cache → transcript → scan), agent-aware priority
- **Atomic writes**: All file writes use write-to-tmp + rename pattern
- **State management**: Zustand with localStorage persistence (prefix: `cliv:`)
- **User data**: Stored in `~/.cliv/` (sessions, annotations)

## Development

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Dev mode (hot reload)
pnpm test             # Run tests (vitest)
pnpm tauri build      # Production build
```

## Testing

Tests are in `src/**/__tests__/`. Run with `pnpm test`.
