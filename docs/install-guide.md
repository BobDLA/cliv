# cliV Installation & Configuration Guide

**[中文版](install-guide.zh-CN.md)**

## 1. Build

```bash
cd cliv
pnpm install
pnpm tauri:build
```

Build artifacts:
- **Binary**: `src-tauri/target/release/cliv`
- **deb package**: `src-tauri/target/release/bundle/deb/cliv_0.2.0_amd64.deb`

`pnpm tauri:build` is the local packaging path. On Linux it loads a deb-only Tauri override so day-to-day debug builds do not also generate extra bundle formats. Use `pnpm tauri:build:release -- <tauri args>` when you need release-parity packaging.

## 2. Install the Binary

Choose the method for your platform:

### Linux
```bash
# Install .deb package
sudo dpkg -i cliv_*.deb
```

### macOS
1. Open the `.dmg` and drag `cliV.app` to your **Applications** folder.

> **💡 Easiest Method**: You can skip creating a symlink. When configuring your Agents or `$EDITOR` later, just copy and paste the absolute path: `/Applications/cliV.app/Contents/MacOS/cliv`

2. *(Optional)* Create a symlink to use the short `cliv` command in your terminal:
```bash
sudo ln -s /Applications/cliV.app/Contents/MacOS/cliv /usr/local/bin/cliv
```

### Verify
```bash
cliv --help  # or: which cliv
```

## 3. Set Environment Variable

Edit `~/.bashrc` or `~/.zshrc`:

```bash
export EDITOR="cliv"
```

Then run `source ~/.bashrc` (or restart your terminal).

> **How it works**: When an AI agent triggers `Ctrl+G`, it invokes `$EDITOR`. Setting it to `cliv` launches the cliV GUI directly.
> `cliv file.md` stays review-only by default; use `cliv --target file.md` when you need an explicit write target (`--compose` remains a compatibility alias).

## 4. Configure Agent Hooks

Each agent needs a one-line hook config so it calls `cliv cache-xxx` to cache the reply after each turn.

---

### 4a. Codex

Edit `~/.codex/config.toml` and add:

```toml
notify = ["cliv", "cache-codex"]
```

**Full example** (create the file if it doesn't exist):

```toml
# ~/.codex/config.toml
model = "o4-mini"
notify = ["cliv", "cache-codex"]
```

**Test**:
```bash
# Manual test
CODEX_THREAD_ID=424242 cliv cache-codex '{"type":"agent-turn-complete","thread-id":"test-123","last-assistant-message":"# Hello\nTest reply."}'
cat ~/.codex/reply_cache/424242.md
cat ~/.codex/reply_cache/424242.meta.json
# 424242 simulates the pid-keyed cache entry used during GUI launches.
```

**Live test**:
1. Start Codex → have a conversation
2. Press `Ctrl+G`
3. cliV should launch and display the latest AI reply

---

### 4b. Claude Code

Edit `~/.claude/settings.json` and add the Stop hook:

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

> ⚠️ If the file already has other configuration, merge the `hooks` section — don't overwrite.

**Test**:
```bash
# Manual test
echo '{"hook_event_name":"Stop","session_id":"test-456","last_assistant_message":"# Hello from Claude"}' | cliv cache-claude
cat ~/.claude/reply_cache/test-456.md
```

**Live test**:
1. Start Claude Code → have a conversation
2. Press `Ctrl+G`
3. cliV should launch and display Claude's latest reply

---

### 4c. Gemini CLI

Edit `~/.gemini/settings.json` and add the AfterAgent hook:

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

**Test**:
```bash
# Manual test
echo '{"prompt_response":"# Hello from Gemini"}' | GEMINI_SESSION_ID=test-789 cliv cache-gemini
cat ~/.gemini/reply_cache/test-789.md
```

**Live test**:
1. Start Gemini CLI → have a conversation
2. Press `Ctrl+G`
3. cliV should launch and display Gemini's latest reply

---

## 5. Verification Checklist

| Step | Command | Expected |
|---|---|---|
| Binary exists | `which cliv` | Shows path |
| EDITOR is set | `echo $EDITOR` | `cliv` |
| Codex hook config | `cat ~/.codex/config.toml` | Contains `notify = ["cliv", "cache-codex"]` |
| Claude hook config | `cat ~/.claude/settings.json` | Contains `"command": "cliv cache-claude"` |
| Codex cache test | Manual command above | Cache and metadata written successfully |
| Claude cache test | Manual command above | File written successfully |
| Ctrl+G live test | Press Ctrl+G in an agent | cliV window opens |

## 6. FAQ & Troubleshooting

### macOS says "cliV is damaged and can't be opened"
This happens because macOS Gatekeeper quarantines apps downloaded from GitHub Releases that aren't signed with an Apple Developer certificate.
**Solution**: Move `cliV.app` to your Applications folder, then run this command in Terminal to remove the quarantine flag:
```bash
sudo xattr -rd com.apple.quarantine /Applications/cliV.app
```

## 7. Uninstall

```bash
# If installed via Method A
rm ~/.local/bin/cliv

# If installed via .deb
sudo dpkg -r cliv

# Clean up user data and cache (optional)
rm -rf ~/.cliv
rm -rf ~/.codex/reply_cache
rm -rf ~/.claude/reply_cache
rm -rf ~/.gemini/reply_cache
```
