# cliV Installation & Configuration Guide

**[中文版](install-guide.zh-CN.md)**

## 1. Install

Download the latest release for your platform from [GitHub Releases](https://github.com/BobDLA/cliv/releases). If you need to build the project from source or participate in development, please refer to the developer documentation in [Build Workflows](build-workflows.md).

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

### Windows
1. Download the `-setup.exe` installer and double-click to install.
2. The installer automatically adds `cliv` to your current user's `PATH`. Once completed, you can use the `cliv` command directly in PowerShell or CMD. You may need to restart your terminal session for the path changes to take effect.

### Verify
```bash
cliv --help  # or: which cliv
```

## 2. Set Environment Variable

> [!CAUTION]
> **This step is critical and often missed.** A correctly configured `$EDITOR` (along with the Agent hook below) is the only way to achieve the seamless "trigger desktop review from the terminal" experience.

Edit your shell profile (e.g., `~/.bashrc` or `~/.zshrc`):

```bash
export EDITOR="cliv"
```

Then run `source ~/.bashrc` (or restart your terminal).

> **How it works**: When an AI agent triggers `Ctrl+G`, it invokes `$EDITOR`. Setting it to `cliv` launches the cliV GUI directly.

## 3. Configure Agent Hooks

> [!CAUTION]
> **Crucial Dependency**: This is the second commonly missed setup step. If the hooks are not configured, cliV will not be able to fetch the agent's latest reply when you trigger the editor shortcut.

Each agent requires a one-line custom hook configuration so it automatically calls `cliv cache-xxx` to safely persist its latest reply to cache after every turn.

---

### 3a. Codex

Edit `~/.codex/config.toml` and add:

```toml
notify = ["cliv", "cache-codex"]
```



**Live test**:
1. Start Codex → have a conversation
2. Press `Ctrl+G`
3. cliV should launch and display the latest AI reply

---

### 3b. Claude Code

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



**Live test**:
1. Start Claude Code → have a conversation
2. Press `Ctrl+G`
3. cliV should launch and display Claude's latest reply

---

### 3c. Gemini CLI

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



**Live test**:
1. Start Gemini CLI → have a conversation
2. Press `Ctrl+G`
3. cliV should launch and display Gemini's latest reply

---

## 4. Verification Checklist

| Step | Command | Expected |
|---|---|---|
| Binary exists | `which cliv` | Shows path |
| EDITOR is set | `echo $EDITOR` | `cliv` |
| Codex hook config | `cat ~/.codex/config.toml` | Contains `notify = ["cliv", "cache-codex"]` |
| Claude hook config | `cat ~/.claude/settings.json` | Contains `"command": "cliv cache-claude"` |
| Codex cache test | Manual command above | Cache and metadata written successfully |
| Claude cache test | Manual command above | File written successfully |
| Ctrl+G live test | Press Ctrl+G in an agent | cliV window opens |

## 5. FAQ & Troubleshooting

### How to verify or debug if the cache hooks are working?

If cliV isn't showing the latest reply after triggering the shortcut, you can manually test the extraction logic using the shell commands below to isolate the issue:

**Codex Debugging**:
```bash
CODEX_THREAD_ID=424242 cliv cache-codex '{"type":"agent-turn-complete","thread-id":"test-123","last-assistant-message":"# Hello\nTest reply."}'
cat ~/.codex/reply_cache/424242.md
```
*(Note: 424242 simulates the pid-keyed cache entry used during GUI launches.)*

**Claude Code Debugging**:
```bash
echo '{"hook_event_name":"Stop","session_id":"test-claude","last_assistant_message":"# Hello from Claude"}' | cliv cache-claude
cat ~/.claude/reply_cache/test-claude.md
```

**Gemini CLI Debugging**:
```bash
echo '{"prompt_response":"# Hello from Gemini"}' | GEMINI_SESSION_ID=test-gemini cliv cache-gemini
cat ~/.gemini/reply_cache/test-gemini.md
```

If these manual commands successfully write the `.md` files into the respective `reply_cache` directories, it means cliV is working correctly and the issue is most likely a typo or wrong path in your Agent's hook configuration file.

### macOS says "cliV is damaged and can't be opened"
This happens because macOS Gatekeeper quarantines apps downloaded from GitHub Releases that aren't signed with an Apple Developer certificate.
**Solution**: Move `cliV.app` to your Applications folder, then run this command in Terminal to remove the quarantine flag:
```bash
sudo xattr -rd com.apple.quarantine /Applications/cliV.app
```

## 6. Uninstall

```bash
# If installed via standalone binary in ~/.local/bin
rm ~/.local/bin/cliv

# If installed via .deb
sudo dpkg -r cliv

# Clean up user data and cache (optional)
rm -rf ~/.cliv
rm -rf ~/.codex/reply_cache
rm -rf ~/.claude/reply_cache
rm -rf ~/.gemini/reply_cache
```
