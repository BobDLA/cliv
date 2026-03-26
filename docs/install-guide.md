# cliV Installation Guide

**[中文版](install-guide.zh-CN.md)**

This guide is the normal end-user setup path.
For non-default path setups, launch semantics, reply-cache lookup rules, and manual debugging, see the [Advanced Integration & Debugging Guide](integrations.md).

## 1. Install

Download the latest release for your platform from [GitHub Releases](https://github.com/BobDLA/cliv/releases). If you need to build from source, see [Build Workflows](build-workflows.md).

### Linux

Official install method:

```bash
sudo dpkg -i cliv_*.deb
```

After installation, `cliv` is available from `/usr/bin/cliv`, so your hook configs and `$EDITOR` can use plain `cliv`.

### macOS

1. Open the `.dmg` and drag `cliV.app` to **Applications**.
2. Choose one launch strategy:

Recommended:
- Do not create a symlink.
- Use the absolute path `/Applications/cliV.app/Contents/MacOS/cliv` directly in `$EDITOR` and in your agent hook commands.

Optional:
- Create a symlink if you want to use the short `cliv` command everywhere.

```bash
sudo ln -s /Applications/cliV.app/Contents/MacOS/cliv /usr/local/bin/cliv
```

### Windows

1. Download the `-setup.exe` installer and run it.
2. The installer places cliV under `%LOCALAPPDATA%\cliv`.
3. The installer adds that directory to the current user's `PATH`.
4. Reopen your terminal after install or update so the new `PATH` is visible.

On Windows, your hook configs and `EDITOR` can normally use plain `cliv`.

### Verify The Binary

Linux / macOS with `cliv` on `PATH`:

```bash
cliv --help
which cliv
```

macOS without a symlink:

```bash
/Applications/cliV.app/Contents/MacOS/cliv --help
```

Windows PowerShell or CMD:

```powershell
cliv --help
where.exe cliv
```

## 2. Set EDITOR

Use the value that matches how your platform resolves cliV.

Linux:

```bash
export EDITOR="cliv"
```

macOS with a symlink:

```bash
export EDITOR="cliv"
```

macOS without a symlink:

```bash
export EDITOR="/Applications/cliV.app/Contents/MacOS/cliv"
```

Windows PowerShell:

```powershell
setx EDITOR cliv
```

Then open a new terminal.

When an agent triggers `Ctrl+G`, it launches `$EDITOR`. That is how cliV opens from the CLI workflow.

## 3. Configure Agent Hooks

If cliV is not on `PATH`, replace every `cliv` command below with the full executable path.
In practice, this mainly applies to macOS when you skip the symlink. On Linux official `.deb` installs and Windows `-setup.exe` installs, you can normally keep `cliv` as-is.

### Codex

Edit `~/.codex/config.toml`:

```toml
notify = ["cliv", "cache-codex"]
```

### Claude Code

Edit `~/.claude/settings.json`:

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

If the file already has other settings, merge the `hooks` block instead of overwriting the file.

### Gemini CLI

Edit `~/.gemini/settings.json`:

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

## 4. Quick Verification

1. Open a fresh terminal and confirm `cliv --help` works.
2. Confirm `EDITOR` resolves to cliV on your platform.
3. Start one agent and let it produce a reply.
4. Press `Ctrl+G`.
5. cliV should open and show the latest agent reply.

If this fails, continue with the [Advanced Integration & Debugging Guide](integrations.md).

## 5. Common Problems

### `cliv` is not found

- Linux: confirm the `.deb` install succeeded and `/usr/bin/cliv` exists.
- macOS without a symlink: use `/Applications/cliV.app/Contents/MacOS/cliv` directly instead of `cliv`.
- Windows: reopen the terminal after install or update, then run `where.exe cliv`.

### macOS says the app is damaged

This happens because unsigned apps downloaded from GitHub Releases are quarantined by Gatekeeper.

```bash
sudo xattr -rd com.apple.quarantine /Applications/cliV.app
```

### Hook or cache debugging

Use the [Advanced Integration & Debugging Guide](integrations.md) for:

- manual cache-write tests
- reply-cache file locations
- launch target resolution
- agent detection and lookup-key behavior

## 6. Uninstall

### Linux

Official `.deb` install:

```bash
sudo dpkg -r cliv
```

If you previously used an older manual test setup, such as copying `cliv` into `~/.local/bin` yourself, remove that custom file separately.

### macOS

1. Delete `/Applications/cliV.app`.
2. If you created a symlink, remove it:

```bash
sudo rm /usr/local/bin/cliv
```

### Windows

Use either of these:

- Settings -> Apps -> Installed apps -> `cliV` -> Uninstall
- `%LOCALAPPDATA%\cliv\uninstall.exe`

### Optional Data Cleanup

The installer only removes the app itself. Your local settings and reply caches are user data and can be removed separately if you want a clean reset.

Linux / macOS paths:

- `~/.cliv`
- `~/.codex/reply_cache`
- `~/.claude/reply_cache`
- `~/.gemini/reply_cache`

Windows paths:

- `%USERPROFILE%\.cliv`
- `%USERPROFILE%\.codex\reply_cache`
- `%USERPROFILE%\.claude\reply_cache`
- `%USERPROFILE%\.gemini\reply_cache`
