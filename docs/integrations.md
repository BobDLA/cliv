# cliV Advanced Integration & Debugging Guide

**[中文版](integrations.zh-CN.md)**

Use the [Installation Guide](install-guide.md) first.
This document is the advanced reference for:

- non-default executable paths
- `$EDITOR` launch behavior
- hook adaptation across platforms
- reply-cache lookup rules
- manual debugging

## 1. Choose The Command Path

Use the executable form that matches your platform:

| Platform | Recommended value for hooks and `$EDITOR` | Notes |
|---|---|---|
| Linux | `cliv` | Official `.deb` installs `cliv` to `/usr/bin/cliv`. |
| Windows | `cliv` | The `-setup.exe` installer adds `%LOCALAPPDATA%\\cliv` to the current user's `PATH`. Reopen the terminal after install or update. |
| macOS | `/Applications/cliV.app/Contents/MacOS/cliv` | The app bundle does not auto-add itself to `PATH`. You can also use `cliv` if you created a symlink manually. |

If cliV is not on `PATH`, replace every `cliv` command below with the full executable path.

## 2. Understand Launch Semantics

cliV supports several caller shapes:

- `cliv review.md`
  Opens `review.md` as the review document and does not automatically treat it as a write target.
- `cliv --target draft.md` or `cliv -t draft.md`
  Uses `draft.md` as the explicit write target.
- `cliv --compose draft.md`
  Compatibility alias for `--target`.
- `cliv <file>` from a trusted caller
  If a trusted caller launches cliV with only one positional file, cliV treats that file as the write target for legacy `$EDITOR` flows.

If no agent is detected, cliV skips reply extraction and stays fail-closed instead of guessing.

## 3. Optional cliV-Owned Settings

Most users do not need this section.

cliV stores its own durable settings in `~/.cliv/config.toml`. The Settings UI writes this file. Agent hook files stay outside this boundary and are not rewritten by cliV.

The most relevant integration section is usually:

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
```

Prompts, UI preferences, and shortcuts also live in the same file, but are usually easier to manage from the cliV Settings panel.

## 4. Hook Reference

The snippets below are the same commands used by the normal install guide, repeated here so you can adapt them for non-default paths.

### Codex

`~/.codex/config.toml`:

```toml
notify = ["cliv", "cache-codex"]
```

macOS without a symlink:

```toml
notify = ["/Applications/cliV.app/Contents/MacOS/cliv", "cache-codex"]
```

Codex passes JSON as a command-line argument to `cliv cache-codex`.

Keep that notify entry for compatibility, then add `~/.codex/hooks.json` so Plan Review replies are delivered through stdin:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cliv cache-codex",
            "timeout": 5,
            "statusMessage": "Caching reply for cliV"
          }
        ]
      }
    ]
  }
}
```

Current Codex Plan Review builds may leave both assistant-message fields null. In that case cliV reads only the same-session, same-turn `item_completed/Plan` entry from the `transcript_path` supplied by the Stop hook; no additional user command is required.

Review and trust the command through `/hooks` in Codex. If the same config layer already uses inline hooks, merge this handler there rather than keeping both inline hooks and `hooks.json`. On macOS without a symlink, use `/Applications/cliV.app/Contents/MacOS/cliv cache-codex` as the command.

### Claude Code

`~/.claude/settings.json`:

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

macOS without a symlink:

- change `cliv cache-claude` to `/Applications/cliV.app/Contents/MacOS/cliv cache-claude`

Claude pipes JSON to stdin containing `session_id` and `last_assistant_message`.

### Gemini CLI

`~/.gemini/settings.json`:

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

macOS without a symlink:

- change `cliv cache-gemini` to `/Applications/cliV.app/Contents/MacOS/cliv cache-gemini`

Gemini pipes JSON to stdin containing `prompt_response`.

## 5. Reply Cache Lookup Rules

cliV only runs the extractor for the detected agent.

### Codex

Reply-cache lookup order:

1. PID cache hit: `CODEX_THREAD_ID` -> `~/.codex/reply_cache/{pid}.md`
2. Metadata match: newest `reply_cache/*.meta.json` whose `real_session_id` matches the lookup key
3. Legacy direct hit: `~/.codex/reply_cache/{thread-id}.md`

### Claude Code

Reply-cache lookup order:

1. Direct cache hit: `CLAUDE_SESSION_ID` -> `~/.claude/reply_cache/{key}.md`
2. Metadata match: newest `reply_cache/*.meta.json` whose `key`, `real_session_id`, or `pid` matches the lookup key
3. Compatibility direct hit: legacy direct file for that same key

### Gemini CLI

Reply-cache lookup order:

1. Direct cache hit: `GEMINI_SESSION_ID` -> `~/.gemini/reply_cache/{key}.md`
2. Metadata match: newest `reply_cache/*.meta.json` whose `key`, `real_session_id`, or `pid` matches the lookup key
3. Compatibility direct hit: legacy direct file for that same key

## 6. Manual Debugging

### Shell Note

The command examples below use a Unix-like shell.
On Windows PowerShell, translate:

- `VAR=value cmd` -> `$env:VAR = 'value'; cmd`
- `cat file` -> `Get-Content file`

Git Bash or WSL also works well for these tests.

### Verify Binary Resolution

Linux / macOS with `PATH`:

```bash
which cliv
cliv --help
```

macOS without a symlink:

```bash
/Applications/cliV.app/Contents/MacOS/cliv --help
```

Windows:

```powershell
where.exe cliv
cliv --help
```

### Verify Hook Output Manually

Codex:

```bash
CODEX_THREAD_ID=424242 cliv cache-codex '{"type":"agent-turn-complete","thread-id":"test-123","last-assistant-message":"# Hello\nTest reply."}'
cat ~/.codex/reply_cache/424242.md

printf '%s' '{"hook_event_name":"Stop","session_id":"test-123","turn_id":"plan-1","permission_mode":"plan","last_assistant_message":"<proposed_plan>\n# Plan\n\n- Review this\n</proposed_plan>"}' | CODEX_THREAD_ID=424242 cliv cache-codex
cat ~/.codex/reply_cache/424242.md
```

Claude Code:

```bash
echo '{"hook_event_name":"Stop","session_id":"test-claude","last_assistant_message":"# Hello from Claude"}' | cliv cache-claude
cat ~/.claude/reply_cache/test-claude.md
```

Gemini CLI:

```bash
echo '{"prompt_response":"# Hello from Gemini"}' | GEMINI_SESSION_ID=test-gemini cliv cache-gemini
cat ~/.gemini/reply_cache/test-gemini.md
```

If these commands write the expected `.md` files, cliV itself is working and the remaining problem is usually:

- the wrong hook file path
- malformed hook JSON or TOML
- a Codex Stop hook that has not been trusted through `/hooks`
- Codex hooks disabled through the `features.hooks` setting
- a shell quoting issue
- a stale terminal session that has not reloaded `PATH` or `EDITOR`

### When cliV opens but shows no reply

Check these in order:

1. Was the correct agent detected?
2. Did the hook actually write a cache file under `~/.codex`, `~/.claude`, or `~/.gemini`?
3. Is the lookup key the one cliV is expecting for that launch context?
4. Did a non-default path or shell quoting issue stop the hook from running?
5. For Codex Plan Review, is the Stop hook listed as trusted under `/hooks`?
6. On Windows, did you reopen the terminal after install or after changing `EDITOR`?
