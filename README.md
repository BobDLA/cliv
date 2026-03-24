# cliV

[![GitHub Stars](https://img.shields.io/github/stars/BobDLA/cliv?style=flat-square&logo=github&label=Stars)](https://github.com/BobDLA/cliv)
[![License](https://img.shields.io/github/license/BobDLA/cliv?style=flat-square)](https://github.com/BobDLA/cliv/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/BobDLA/cliv?style=flat-square&label=Release)](https://github.com/BobDLA/cliv/releases)

**[中文版](README.zh-CN.md)**

> ### Tame the AI Flood. Review with precision.
> 
> **A desktop reviewer crafted for command-line invocation.** Escape the flood of terminal text with a single shortcut: read long AI replies comfortably in rich text, make precise selection-based annotations, and write the aggregated prompt right back to your target workflow.

![cliV Screenshot](docs/image.png)

<video src="docs/demo_cliv.mp4" controls="controls" width="100%" muted="true" loop="true"></video>

## Why cliV?

AI coding agents (Codex, Claude Code, Gemini CLI) produce long, structured replies — but you're reading them in a terminal. That's fine for 20 lines, painful for 500.

**cliV** can be set as an external editor for Claude Code, Codex, and Gemini, invoked via shortcut, enabling review, annotation, prompt return, and history functions:

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

## Installation and Configuration

Please refer to our dedicated guide documents:
- [Install Guide](docs/install-guide.md)
- [Agent Integrations Guide](docs/integrations.md)

These documents explain how to download or build cliV, set up `$EDITOR`, and configure integrations and `config.toml` hooks for agents like Codex, Claude Code, and Gemini CLI. Architecture and contributor notes are also linked across specific internal documents.

## Quick Start

1. Start your AI agent (Codex, Claude Code, or Gemini CLI)
2. Have a conversation that generates a long reply
3. Trigger the agent's `$EDITOR` flow (commonly `Ctrl+G`, but depends on agent / config)
4. cliV opens with the agent's latest reply rendered as rich Markdown
5. Select text → annotate → aggregate → write back or copy the result

## Workflow

```mermaid
%%{init: {"themeVariables": {"fontSize": "18px"}, "flowchart": {"nodeSpacing": 60, "rankSpacing": 80, "padding": 24}} }%%
flowchart LR
    subgraph A["CLI Coding Tools"]
        A1["Claude Code"]
        A2["Codex"]
        A3["Gemini"]
    end

    B["Trigger `$EDITOR` via shortcut<br/>(e.g., Ctrl+G)"]

    subgraph C["cliV Review Phase"]
        C1["Auto-extract latest reply"]
        C2["Rich text reading"]
        C3["Add/Edit/Delete annotations"]
        C4["Aggregate annotations as Prompt"]
    end

    subgraph D["Return Result"]
        D1["Write back to explicit target"]
        D2["Fallback to clipboard"]
    end

    A1 --> B
    A2 --> B
    A3 --> B
    B --> C1 --> C2 --> C3 --> C4
    C4 --> D1
    C4 -. No write target .-> D2

    classDef cli fill:#EDF4FF,stroke:#5B8DEF,color:#17325C,stroke-width:1.5px;
    classDef review fill:#EEF8F1,stroke:#43A047,color:#1F4D2E,stroke-width:1.5px;
    classDef back fill:#FFF4E5,stroke:#FB8C00,color:#6A3A00,stroke-width:1.5px;

    class A1,A2,A3,B cli;
    class C1,C2,C3,C4 review;
    class D1,D2 back;
```

## Features

- 📖 **Rich Markdown rendering** — headings, code blocks, tables, Mermaid diagrams
- ✏️ **Selection-based annotations** — highlight passages and add comments (in-text highlights rely on CSS Highlight API)
- 📋 **Write-back flow** — aggregate annotations into a prompt, then write back or copy
- 🔄 **Multi-agent support** — best-effort auto-detection of Codex / Claude / Gemini; force with `CLIV_AGENT`
- 📂 **Open local Markdown** — review cached replies or open `.md` files directly with safe review-only defaults
- 🎛️ **Unified settings** — manage Reading, Prompts, Shortcuts, and Integrations from one settings surface backed by `~/.cliv/config.toml`

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
- [x] Review history (project-grouped archives with read-only replay)
- [ ] Favorites
- [ ] Iterative editing mode

## License

MIT
