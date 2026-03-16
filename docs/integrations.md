# cliV: Agent Integration Guide

This document explains how to integrate cliV with Codex, Claude Code, and Gemini CLI.

## How It Works

cliV is a single binary with no external dependencies (no Python, no Bash).

1. **Agent hook** calls `cliv cache-xxx` after each reply → caches to disk
2. **You press Ctrl+G** → agent calls `$EDITOR` (which is `cliv`)
3. **cliV** auto-detects which agent called it, loads the cached reply, and opens the GUI

```
Agent completes a reply
    ↓ hook fires
    cliv cache-codex / cache-claude / cache-gemini
    ↓ writes ~/.{agent}/reply_cache/{id}.md

You press Ctrl+G
    ↓ $EDITOR = cliv
    cliv --compose <file>
    ↓ auto-detects agent from env vars
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

### Step 3: Configure agent hooks

Pick your agent(s) below.

---

## Codex

Add to `~/.codex/config.toml`:

```toml
notify = ["cliv", "cache-codex"]
```

**How it works**: When Codex completes a turn, it calls `cliv cache-codex '<json>'` with JSON as an argument. cliV extracts `thread-id` and `last-assistant-message` and caches to `~/.codex/reply_cache/{thread-id}.md`.

### Extraction fallback chain

1. **Cache hit**: `CODEX_THREAD_ID` → `~/.codex/reply_cache/{id}.md`
2. **SQLite query**: Match CWD in `~/.codex/state_5.sqlite`
3. **JSONL scan**: Find newest file in `~/.codex/sessions/`

---

## Claude Code

Add to `~/.claude/settings.json`:

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

When launched as `$EDITOR`, cliV auto-detects the calling agent from environment variables (`CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, `GEMINI_SESSION_ID`). No `CLIV_AGENT` env var is needed unless you want to override.

### Extraction priority

When the agent is unknown, cliV tries: **Claude → Gemini → Codex**.

> **Why?** Codex's fallback scanner always returns _something_ (even stale data), so it goes last to avoid masking fresher replies.
