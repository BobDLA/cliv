# cliV

**[中文版](README.zh-CN.md)**

**cliV** — A GUI reviewer for AI agent replies, triggered from your CLI.
Read, annotate, and return structured feedback to the current thread.

<!-- TODO: Add hero screenshot -->
<!-- ![cliV screenshot](docs/media/hero.png) -->

## Why cliV?

AI coding agents (Codex, Claude Code, Gemini CLI) produce long, structured replies — but you're reading them in a terminal. That's fine for 20 lines, painful for 500.

**cliV** gives you a real GUI when you press `Ctrl+G`:

- **Review** long AI replies with full Markdown + Mermaid rendering
- **Annotate** exact passages instead of writing vague follow-ups
- **Return** structured feedback to the current thread with one click

## Works With

| Agent | Integration | Hook Command |
|---|---|---|
| [Codex](https://github.com/openai/codex) | `notify` hook | `cliv cache-codex` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `Stop` hook | `cliv cache-claude` |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `AfterAgent` hook | `cliv cache-gemini` |

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

Then configure your agent hooks — see [docs/integrations.md](docs/integrations.md) for details.

## Quick Start

1. Start your AI agent (Codex, Claude Code, or Gemini CLI)
2. Have a conversation that generates a long reply
3. Press `Ctrl+G`
4. cliV opens with the agent's latest reply rendered as rich Markdown
5. Select text → annotate → aggregate → return feedback to the thread

## Features

- 📖 **Rich Markdown rendering** — headings, code blocks, tables, Mermaid diagrams
- ✏️ **Selection-based annotations** — highlight passages and add comments
- 📋 **Structured feedback** — aggregate annotations into a prompt, return to the agent
- 🔄 **Multi-agent support** — auto-detects Codex / Claude / Gemini
- 📂 **Session history** — local persistence of past reviews
- 🌙 **Theme switching** — light / dark mode
- 🔍 **Font scaling** — adjust reading comfort

## Tech Stack

- **Frontend**: React 19 + Vite 7 + Zustand + TailwindCSS 4
- **Backend**: Tauri v2 (Rust)
- **Rendering**: react-markdown + remark-gfm + Mermaid

## Roadmap

- [ ] Virtual scrolling for large documents
- [ ] Diff / suggestion mode
- [ ] Standalone review mode (open any `.md` file)
- [ ] Cross-platform builds (macOS, Windows)
- [ ] Plugin system for custom agents

## License

MIT
