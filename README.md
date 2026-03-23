# cliV

[![GitHub Stars](https://img.shields.io/github/stars/BobDLA/cliv?style=flat-square&logo=github&label=Stars)](https://github.com/BobDLA/cliv)
[![License](https://img.shields.io/github/license/BobDLA/cliv?style=flat-square)](https://github.com/BobDLA/cliv/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/BobDLA/cliv?style=flat-square&label=Release)](https://github.com/BobDLA/cliv/releases)

**[中文版](README.zh-CN.md)**

cliV is a desktop review surface for long AI agent replies. Use it as `$EDITOR` from Codex, Claude Code, or Gemini CLI to read rich Markdown, annotate exact passages, aggregate feedback, and send the result back by write-back or clipboard.

## Why cliV

Terminal agents are good at generating long structured replies. They are not good at close review. cliV keeps the coding loop in the terminal and moves only the review step into a desktop GUI when a reply needs careful inspection.

## Core Workflow

1. Your agent hook caches each finished reply with `cliv cache-codex`, `cliv cache-claude`, or `cliv cache-gemini`.
2. The agent triggers `$EDITOR` for review, commonly `Ctrl+G` depending on the tool and config.
3. cliV loads the latest reply, renders it as Markdown, and lets you annotate by text selection.
4. cliV aggregates the annotations and either writes back to the current target or copies the result to the clipboard.

## What cliV Supports

- Rich Markdown review for headings, tables, code blocks, and Mermaid diagrams
- Selection-based annotations with multi-annotation aggregation
- Direct write-back when an explicit or trusted target exists
- Clipboard fallback when no write target is available
- Standalone review for local `.md`, `.markdown`, and `.txt` files
- Unified cliV-owned settings in `~/.cliv/config.toml`

## Supported Agents

| Agent | Hook | Cache Command | Input Shape |
|---|---|---|---|
| [Codex](https://github.com/openai/codex) | `notify` | `cliv cache-codex` | JSON via CLI argument |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `Stop` | `cliv cache-claude` | JSON via stdin |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `AfterAgent` | `cliv cache-gemini` | JSON via stdin plus `GEMINI_SESSION_ID` |

## Install

Download the latest assets from [GitHub Releases](https://github.com/BobDLA/cliv/releases). The current release workflow publishes platform builds for Linux, macOS, and Windows.

To build from source:

```bash
git clone https://github.com/BobDLA/cliv.git
cd cliv
pnpm install
pnpm tauri build
```

Prerequisites: Node.js 20+, Rust stable, and pnpm.

## Quick Setup

Set cliV as your editor:

```bash
export EDITOR="cliv"
```

Then configure the hook for your agent. Detailed setup lives in [docs/integrations.md](docs/integrations.md).

## Launch Semantics

- `cliv file.md` opens the file in review mode
- `cliv --target draft.md` or `cliv -t draft.md` uses `draft.md` as the explicit write-back target
- `cliv --compose draft.md` remains as a compatibility alias for `--target`
- `CLIV_AGENT=codex|claude|gemini` is only needed when you want to override auto-detection

cliV writes back directly only when an explicit target exists or the launch comes from a trusted caller. Otherwise it falls back to the clipboard.

## Configuration Boundary

cliV stores its own durable settings in `~/.cliv/config.toml`, including launch policy, prompts, reading preferences, and supported in-app shortcuts. Agent hook files remain owned by Codex, Claude Code, and Gemini CLI, and cliV does not rewrite them directly.

## Documentation

- [Quick overview and demo](docs/demo/overview-and-quickstart.md)
- [Installation guide](docs/install-guide.md)
- [Agent integration guide](docs/integrations.md)
- [Archived issue research](docs/issues/)

## Development

```bash
pnpm test
pnpm lint
pnpm typecheck
cargo test --manifest-path src-tauri/Cargo.toml
```

## Tech Stack

- Frontend: React 19, Vite 7, Zustand, TailwindCSS 4
- Backend: Tauri v2 with Rust
- Rendering: `react-markdown`, `remark-gfm`, Mermaid

## License

MIT
