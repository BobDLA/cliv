# cliV

[![GitHub Stars](https://img.shields.io/github/stars/BobDLA/cliv?style=flat-square&logo=github&label=Stars)](https://github.com/BobDLA/cliv)
[![License](https://img.shields.io/github/license/BobDLA/cliv?style=flat-square)](https://github.com/BobDLA/cliv/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/BobDLA/cliv?style=flat-square&label=Release)](https://github.com/BobDLA/cliv/releases)

**[中文版](README.zh-CN.md)**

**cliV** — A desktop reviewer launched from the CLI, for reading long AI agent replies and Markdown drafts.
Read, annotate, then write back when there's an explicit or trusted write target; copy the result when there isn't.

<!-- TODO: Add hero screenshot -->
<!-- ![cliV screenshot](docs/media/hero.png) -->

## Why cliV?

AI coding agents (Codex, Claude Code, Gemini CLI) produce long, structured replies — but you're reading them in a terminal. That's fine for 20 lines, painful for 500.

When your agent invokes `$EDITOR` (commonly `Ctrl+G`, but depends on agent and config), **cliV** opens a desktop GUI better suited for review:

- **Review** — full Markdown + Mermaid diagram rendering, no more plain text
- **Annotate** — select exact passages to add comments instead of writing vague follow-ups
- **Write back** — write back to the active write target when available, fall back to clipboard otherwise
- **Open** — also open local Markdown files for standalone review

## Supported Agents

| Agent | Integration | Hook Command |
|---|---|---|
| [Codex](https://github.com/openai/codex) | `notify` hook | `cliv cache-codex` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `Stop` hook | `cliv cache-claude` |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `AfterAgent` hook | `cliv cache-gemini` |

`cache-codex` receives JSON via CLI arguments; `cache-claude` and `cache-gemini` read JSON from stdin. Gemini also relies on `GEMINI_SESSION_ID`.

## Install

### Download (recommended)

Grab the latest release from [GitHub Releases](https://github.com/BobDLA/cliv/releases):

- **Linux**: `.deb` package or standalone binary

```bash
# Install .deb
sudo dpkg -i cliv_0.2.0_amd64.deb

# Or copy the binary directly
cp cliv ~/.local/bin/
```

### Build from source

```bash
# Prerequisites: Node.js 20+, Rust 1.75+, pnpm
git clone https://github.com/BobDLA/cliv.git
cd cliv
pnpm install
pnpm tauri build
# Binary at src-tauri/target/release/cliv
```

### Set up as your `$EDITOR`

```bash
# Add to ~/.bashrc or ~/.zshrc
export EDITOR="cliv"
```

Keeping `$EDITOR` as plain `cliv` is fine; if your caller supports explicit arguments, you can also pass `--target <file>`. Then configure your agent hooks — see [docs/integrations.md](docs/integrations.md) for details.

## Quick Start

1. Start your AI agent (Codex, Claude Code, or Gemini CLI)
2. Have a conversation that generates a long reply
3. Trigger the agent's `$EDITOR` flow (commonly `Ctrl+G`, but depends on agent / config)
4. cliV opens with the agent's latest reply rendered as rich Markdown
5. Select text → annotate → aggregate → write back or copy the result

## Features

- 📖 **Rich Markdown rendering** — headings, code blocks, tables, Mermaid diagrams
- ✏️ **Selection-based annotations** — highlight passages and add comments (in-text highlights rely on CSS Highlight API)
- 📋 **Write-back flow** — aggregate annotations into a prompt, then write back or copy
- 🔄 **Multi-agent support** — best-effort auto-detection of Codex / Claude / Gemini; force with `CLIV_AGENT`
- 📂 **Open local Markdown** — review cached replies or open `.md` files directly with safe review-only defaults
- 🗂️ **Save sessions** — persist review snapshots and annotations locally (local-only for now)
- 🌙 **Theme switching** — dark / muted / light
- 🔍 **Font scaling** — adjust reading comfort

## Notes

- **Launch semantics** — `cliv <file.md>` opens that file for review. `cliv --target <file>`, `cliv -t <file>`, and the compatibility alias `cliv --compose <file>` treat the file as the write target.
- **Write-back behavior** — cliV writes back directly only when an explicit target is present or the launch comes from a trusted caller; otherwise it falls back to clipboard.
- **Local storage** — integration hooks cache replies under each agent's `reply_cache` directory; session data is also local-only for now.
- **Auto-detection** — agent detection relies on environment variables and process heuristics; to force, set `CLIV_AGENT=codex|claude|gemini`. Trusted callers, scan depth, and prompt headers can be configured in `~/.cliv/config.toml`.
- **Logging** — on non-Windows systems, cliV may write diagnostic logs to `/tmp/cliv.log`.

### Example `~/.cliv/config.toml`

```toml
[launch]
scan_depth = 5
trusted_callers = ["codex", "claude", "gemini"]
ignored_callers = ["bash", "zsh", "fish", "tmux", "launchd", "open"]

[prompts]
reply_header_zh = "请基于以下批注逐条回应。请以 Markdown 格式返回。"
reply_header_en = "Please respond to each annotation below in Markdown."
iterate_header_zh = "请根据以下批注，对原文进行增量修改。"
iterate_header_en = "Please make incremental revisions based on the following annotations."
```

## Tech Stack

- **Frontend**: React 19 + Vite 7 + Zustand + TailwindCSS 4
- **Backend**: Tauri v2 (Rust)
- **Rendering**: react-markdown + remark-gfm + Mermaid

## Roadmap

- [ ] Virtual scrolling for large documents
- [ ] Diff / suggestion mode
- [x] Standalone review polish (`cliv <file.md>` now stays review-only by default)
- [x] Cross-platform builds (macOS, Windows)
- [ ] Plugin system for custom agents
- [ ] Review history
- [ ] Favorites
- [ ] Iterative editing mode

## License

MIT
