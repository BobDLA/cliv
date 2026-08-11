# cliV 安装指南

**[English](install-guide.md)**

这份文档只覆盖普通用户的正式安装路径。
如果你需要看非默认路径、启动语义、reply cache 查找规则、手工调试，请继续看 [高级集成与调试参考](integrations.zh-CN.md)。

## 1. 安装

从 [GitHub Releases](https://github.com/BobDLA/cliv/releases) 下载对应平台的正式发布版本。如果你需要从源码构建，请参考 [Build Workflows](build-workflows.md)。

### Linux

官方安装方式：

```bash
sudo dpkg -i cliv_*.deb
```

安装完成后，`cliv` 会出现在 `/usr/bin/cliv`，因此 hook 配置和 `$EDITOR` 都可以直接写成 `cliv`。

### macOS

1. 打开 `.dmg`，把 `cliV.app` 拖入 **应用程序 (Applications)**。
2. 选择一种调用方式：

推荐：
- 不创建软链接。
- 在 `$EDITOR` 和各个 Agent hook 里直接使用绝对路径 `/Applications/cliV.app/Contents/MacOS/cliv`。

可选：
- 如果你希望始终使用短命令 `cliv`，再创建软链接。

```bash
sudo ln -s /Applications/cliV.app/Contents/MacOS/cliv /usr/local/bin/cliv
```

### Windows

1. 下载 `-setup.exe` 安装包并运行。
2. 安装器会把 cliV 安装到 `%LOCALAPPDATA%\cliv`。
3. 安装器会把这个目录加入“当前用户”的 `PATH`。
4. 安装或更新后，请重新打开终端，让新的 `PATH` 生效。

在 Windows 上，hook 配置和 `EDITOR` 一般都可以直接写成 `cliv`。

### 验证二进制是否可用

Linux / macOS 且 `cliv` 已在 `PATH` 中：

```bash
cliv --help
which cliv
```

macOS 未创建软链接：

```bash
/Applications/cliV.app/Contents/MacOS/cliv --help
```

Windows PowerShell 或 CMD：

```powershell
cliv --help
where.exe cliv
```

## 2. 设置 EDITOR

`EDITOR` 的值要和你当前平台上 cliV 的可执行路径保持一致。

Linux：

```bash
export EDITOR="cliv"
```

macOS 已创建软链接：

```bash
export EDITOR="cliv"
```

macOS 未创建软链接：

```bash
export EDITOR="/Applications/cliV.app/Contents/MacOS/cliv"
```

Windows PowerShell：

```powershell
setx EDITOR cliv
```

然后重新打开一个新的终端。

在 Agent 的普通输入框中触发 `Ctrl+G` 时，它会启动 `$EDITOR`。Codex 的 Plan 决策弹窗当前会接管键盘输入，因此需要先回到输入框再使用该快捷键。

## 3. 配置 Agent Hook

如果 cliV 不在你的 `PATH` 里，请把下面所有 `cliv` 都替换成完整可执行路径。
实际使用中，这主要发生在“未创建软链接的 macOS”场景。Linux 的官方 `.deb` 安装和 Windows 的 `-setup.exe` 安装，一般都可以直接保留 `cliv`。

### Codex

编辑 `~/.codex/config.toml`：

```toml
notify = ["cliv", "cache-codex"]
```

`notify` 继续兼容普通已完成回合。为了在 Codex 进入 Plan Review 时捕获计划，还要创建 `~/.codex/hooks.json`：

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

测试前请在 Codex 中打开 `/hooks` 并信任该 Hook；新的或发生变化的 command Hook 在完成审核前会被跳过。如果你已经在 `config.toml` 中使用 inline Codex Hooks，请把这个 `Stop` handler 合并到现有配置，不要同时维护两种表示。macOS 未创建软链接时，把 command 改为 `/Applications/cliV.app/Contents/MacOS/cliv cache-codex`。

### Claude Code

编辑 `~/.claude/settings.json`：

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

如果文件里已经有别的设置，请把 `hooks` 部分合并进去，不要整文件覆盖。

### Gemini CLI

编辑 `~/.gemini/settings.json`：

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

## 4. 快速验证

1. 重新打开一个新的终端，确认 `cliv --help` 可以正常运行。
2. 确认 `EDITOR` 的值确实指向 cliV。
3. 启动任意一个 Agent，让它先产出一条回复。
4. 按 `Ctrl+G`。
5. cliV 应该弹出，并显示这条最新回复。

如果这里失败了，请继续看 [高级集成与调试参考](integrations.zh-CN.md)。

## 5. 常见问题

### 提示找不到 `cliv`

- Linux：确认 `.deb` 安装成功，并且 `/usr/bin/cliv` 存在。
- macOS 未创建软链接：不要写 `cliv`，直接使用 `/Applications/cliV.app/Contents/MacOS/cliv`。
- Windows：安装或更新后重新打开终端，再执行 `where.exe cliv`。

### macOS 提示应用已损坏

这是因为从 GitHub Releases 下载的未签名应用会被 Gatekeeper 隔离。

```bash
sudo xattr -rd com.apple.quarantine /Applications/cliV.app
```

### Hook 或缓存调试

以下内容都放到了 [高级集成与调试参考](integrations.zh-CN.md)：

- 手工 cache 写入测试
- reply cache 文件位置
- 启动目标解析规则
- agent 检测与 lookup key 行为

## 6. 卸载

### Linux

官方 `.deb` 安装：

```bash
sudo dpkg -r cliv
```

如果你之前做过旧式手工测试，例如自己把 `cliv` 复制到 `~/.local/bin`，那种“自定义路径”需要你自行删除；它不属于当前正式安装流程。

### macOS

1. 删除 `/Applications/cliV.app`
2. 如果你创建过软链接，再删除它：

```bash
sudo rm /usr/local/bin/cliv
```

### Windows

任选一种方式：

- 设置 -> 应用 -> 已安装的应用 -> `cliV` -> 卸载
- `%LOCALAPPDATA%\cliv\uninstall.exe`

### 可选：清理用户数据

安装器只会移除应用本体。你自己的设置文件和 reply cache 属于用户数据，需要按需单独删除。

Linux / macOS 路径：

- `~/.cliv`
- `~/.codex/reply_cache`
- `~/.claude/reply_cache`
- `~/.gemini/reply_cache`

Windows 路径：

- `%USERPROFILE%\.cliv`
- `%USERPROFILE%\.codex\reply_cache`
- `%USERPROFILE%\.claude\reply_cache`
- `%USERPROFILE%\.gemini\reply_cache`
