# cliV: Agent Integration Guide

**[中文版](integrations.zh-CN.md)**

This document explains how to integrate cliV with Codex, Claude Code, and Gemini CLI.

## How It Works

> **💡 Note**: This section explains the underlying mechanics. If you just want to use the tool, you can **skip this and go straight to [Setup](#setup)**.

cliV is a single binary with no external dependencies (no Python, no Bash).

1. **Agent hook** calls `cliv cache-xxx` after each reply → caches to disk
2. **You press Ctrl+G** → agent calls `$EDITOR` (usually just `cliv`)
3. **cliV** auto-detects the calling agent, resolves any write target from explicit flags or trusted-caller rules, then opens the GUI

```
Agent completes a reply
    ↓ hook fires
    cliv cache-codex / cache-claude / cache-gemini
    ↓ writes ~/.{agent}/reply_cache/<cache-key>.md

You press Ctrl+G
    ↓ $EDITOR = cliv
    cliv <file>                 # legacy caller shape
    or cliv --target <file>     # preferred when the caller supports explicit args
    ↓ auto-detects agent from env vars
    ↓ resolves write target from explicit flags or trusted-caller matching
    ↓ loads cached reply
    cliV GUI opens
```

---

## Setup

### Step 1: Install

```bash
# From GitHub Release
cp cliv ~/.local/bin/
# Or: sudo dpkg -i cliv_0.2.0_amd64.deb
```

### Step 2: Set $EDITOR

```bash
# ~/.bashrc or ~/.zshrc
export EDITOR="cliv"
```

If your caller supports extra arguments, you can also use:

```bash
export EDITOR="cliv --target"
```

If the caller can only launch `cliv <file>`, cliV will still treat that positional file as the write target when the parent-process chain matches a trusted caller. Plain standalone launches stay review-only.

### Optional: configure cliV-owned settings

cliV keeps its own durable settings in `~/.cliv/config.toml`. The Settings panel writes the same file for `Reading`, `Prompts`, and supported `Shortcuts`. Codex / Claude / Gemini hook files stay outside this boundary and are not rewritten by cliV.

Edit `~/.cliv/config.toml`:

```toml
[launch]
scan_depth = 5
trusted_callers = ["codex", "claude", "gemini"]
ignored_callers = [
  "bash",
  "sh",
  "zsh",
  "fish",
  "tmux",
  "open",
  "launchd",
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
  "explorer.exe",
]

[prompts]
reply_header_zh = "请基于以下批注逐条回应。请以 Markdown 格式返回。"
reply_header_en = "Please respond to each annotation below in Markdown."
iterate_header_zh = "请根据以下批注，对原文进行增量修改。"
iterate_header_en = "Please make incremental revisions based on the following annotations."

[ui]
theme = "light"
font_size = 18
locale = "en"
sidebar_open = true
sidebar_tab = "outline"
sidebar_width = 224
annotation_margin_width = 256
content_width = "standard"
page_padding = "comfortable"
reading_density = "comfortable"
highlight_strength = "balanced"

[ui.shortcuts]
open_file = "Mod+O"
search = "Mod+F"
submit_return = "Mod+Enter"
submit_annotation = "Mod+Enter"
add_annotation = "Mod+Alt+M"
font_increase = "Mod+="
font_decrease = "Mod+-"
font_reset = "Mod+0"
```

If `submit_annotation` and `submit_return` share `Mod+Enter`, cliV resolves the conflict by focus priority: annotation submit wins while the annotation editor is active; otherwise the key falls through to return submit.

### Step 3: Configure agent hooks

Pick your agent(s) below.

---

## Codex

Add to `~/.codex/config.toml`:

```toml
# Linux / macOS (if cliv is symlinked in PATH)
notify = ["cliv", "cache-codex"]

# 🍏 macOS Easiest Setup (Direct path, no symlink needed)
# notify = ["/Applications/cliV.app/Contents/MacOS/cliv", "cache-codex"]
```

**How it works**: When Codex completes a turn, it calls `cliv cache-codex '<json>'` with JSON as an argument. cliV extracts `thread-id` and `last-assistant-message`, detects the active Codex PID, writes `~/.codex/reply_cache/{pid}.md`, and stores the real thread ID in `~/.codex/reply_cache/{pid}.meta.json`.

### Extraction fallback chain

1. **PID cache hit**: `CODEX_THREAD_ID` (compatibility env name for the active Codex cache key, usually the agent PID) → `~/.codex/reply_cache/{pid}.md`
2. **Metadata match**: Find the newest `reply_cache/*.meta.json` whose `real_session_id` matches the lookup key
3. **Legacy cache hit**: Direct file match `~/.codex/reply_cache/{thread-id}.md`

---

## Claude Code

Add to `~/.claude/settings.json`:

> **🍏 macOS Note**: If you didn't create a symlink, change `"cliv cache-claude"` below to the exact absolute path: `"/Applications/cliV.app/Contents/MacOS/cliv cache-claude"`

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cliv cache-claude"
          }
        ]
      }
    ]
  }
}
```

**How it works**: Claude pipes JSON to stdin containing `session_id` and `last_assistant_message`. cliV caches to `~/.claude/reply_cache/{session-id}.md`.

### Extraction fallback chain

1. **Cache hit**: `CLAUDE_SESSION_ID` → `~/.claude/reply_cache/{id}.md`
2. **Transcript scan**: Newest JSONL in `~/.claude/transcripts/`

---

## Gemini CLI

Add to `~/.gemini/settings.json`:

> **🍏 macOS Note**: If you didn't create a symlink, change `"cliv cache-gemini"` below to the exact absolute path: `"/Applications/cliV.app/Contents/MacOS/cliv cache-gemini"`

```json
{
  "hooks": {
    "AfterAgent": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cliv cache-gemini"
          }
        ]
      }
    ]
  }
}
```

**How it works**: Gemini pipes JSON to stdin containing `prompt_response`. The session ID comes from the `GEMINI_SESSION_ID` env var (injected by Gemini). cliV caches to `~/.gemini/reply_cache/{session-id}.md`.

### Extraction fallback chain

1. **Cache hit**: `GEMINI_SESSION_ID` → `~/.gemini/reply_cache/{id}.md`
2. **File scan**: Newest `.md` in `~/.gemini/reply_cache/`

---

## Notes

### Zero dependencies

cliV is a single binary. No Python, Bash, Node.js, or wrapper scripts needed.

### Agent auto-detection

When launched as `$EDITOR`, cliV auto-detects the calling agent from environment variables (`CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, `GEMINI_SESSION_ID`). For Codex, `CODEX_THREAD_ID` is kept as a compatibility variable name, but the value used for cache lookup is normally the active agent PID. No `CLIV_AGENT` env var is needed unless you want to override.

### Launch modes

- `cliv file.md`: open `file.md` as the review document and do not treat it as a write target.
- `cliv --target draft.md` / `cliv -t draft.md`: use `draft.md` as the explicit write target.
- `cliv --compose draft.md`: compatibility alias for `--target`.
- If a trusted caller launches cliV with only one positional file, that file is treated as the write target for legacy `$EDITOR` integrations.

### Extraction priority

When the agent is unknown, cliV tries: **Claude → Gemini → Codex**.

> **Why?** Codex's fallback scanner always returns _something_ (even stale data), so it goes last to avoid masking fresher replies.
