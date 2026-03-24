# cliV 安装与配置指南

**[English](install-guide.md)**

## 1. 安装

从 [GitHub Releases](https://github.com/BobDLA/cliv/releases) 获取最新版本，并根据你的系统选择合适的安装方式。如果你需要从源码参与开发构建，请参阅开发者文档 [Build Workflows](build-workflows.md)。

### Linux
```bash
# 安装 deb 包（自动放置到 /usr/bin/）
sudo dpkg -i cliv_*.deb
```

### macOS
1. 打开 `.dmg` 并将 `cliV.app` 拖入 **应用程序 (Applications)** 文件夹。

> **💡 最简配置（推荐普通用户使用）**：你可以完全跳过终端敲代码的步骤。在后续配置 Agent 和环境变量时，只要看到 `cliv`，直接替换成这个绝对路径即可：`/Applications/cliV.app/Contents/MacOS/cliv`

2. *(可选)* 创建软链接，让你可以在终端随时输入短命令 `cliv`：
```bash
sudo ln -s /Applications/cliV.app/Contents/MacOS/cliv /usr/local/bin/cliv
```

### Windows
1. 下载 `.msi` 安装包并双击运行安装向导。
2. 安装程序会自动将 `cliv` 添加到系统的 `PATH` 环境变量中。安装完成后，你可以在 PowerShell 或 CMD 中直接使用 `cliv` 命令。由于环境变量刷新机制，首次安装可能需要重启终端软件才能生效。

### 验证
```bash
cliv --help  # 或 which cliv
```

## 2. 设置环境变量

> [!CAUTION]
> **此步骤非常重要且容易出错**。只有正确配置了 `$EDITOR` 和下方的 Agent hook，才能实现“终端快捷键自动唤起桌面审阅”。

编辑/添加环境变量到配置（例如 `~/.bashrc` 或 `~/.zshrc`）：

```bash
export EDITOR="cliv"
```

然后 `source ~/.bashrc`（或重启终端）。

> **原理**：当 AI agent 触发 Ctrl+G 时，它会调用 `$EDITOR`。设成 `cliv` 后，agent 会直接启动 cliV。

## 3. 配置 Agent Hook

> [!CAUTION]
> **关键步骤**：这是第二处容易遗漏的核心配置。如果不配置 Hook，按下触发键时 cliV 将无法获取到 Agent 最新的回复内容。此步骤对集成至关重要。

每个 agent 需要一行自定义 hook 配置，让它在完成每次回复后必定调用 `cliv cache-xxx` 来将最新内容安全写入本机缓存。

---

### 3a. Codex

编辑 `~/.codex/config.toml`，添加：

```toml
notify = ["cliv", "cache-codex"]
```



**真实测试**：
1. 启动 Codex → 进行一轮对话
2. 按 `Ctrl+G`
3. cliV 应弹出并显示 AI 最新回复

---

### 3b. Claude Code

编辑 `~/.claude/settings.json`，添加 Stop hook：

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

> ⚠️ 如果文件已有其他配置，把 `hooks` 部分合并进去，不要覆盖。



**真实测试**：
1. 启动 Claude Code → 进行一轮对话
2. 按 `Ctrl+G`
3. cliV 应弹出并显示 Claude 最新回复

---

### 3c. Gemini CLI

编辑 `~/.gemini/settings.json`，添加 AfterAgent hook：

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



**真实测试**：
1. 启动 Gemini CLI → 进行一轮对话
2. 按 `Ctrl+G`（需要 $EDITOR 支持后）
3. cliV 应弹出并显示 Gemini 最新回复

---

## 4. 验证清单

| 步骤 | 命令 | 预期 |
|---|---|---|
| 二进制存在 | `which cliv` | 显示路径 |
| EDITOR 设置 | `echo $EDITOR` | `cliv` |
| Codex hook 配置 | `cat ~/.codex/config.toml` | 含 `notify = ["cliv", "cache-codex"]` |
| Claude hook 配置 | `cat ~/.claude/settings.json` | 含 `"command": "cliv cache-claude"` |
| Codex cache 测试 | 上面的手动命令 | 缓存和元数据写入成功 |
| Claude cache 测试 | 上面的手动命令 | 文件写入成功 |
| Ctrl+G 真实测试 | 在 agent 中按 Ctrl+G | cliV 窗口弹出 |

## 5. 常见问题与调试 (FAQ & Troubleshooting)

### 如何验证或调试缓存 Hook 是否工作？

如果按下快捷键后 cliV 没有显示最新的回复，你可以通过下方的手动调试命令测试提取逻辑是否正常：

**Codex 调试**：
```bash
CODEX_THREAD_ID=424242 cliv cache-codex '{"type":"agent-turn-complete","thread-id":"test-123","last-assistant-message":"# Hello\nTest reply."}'
cat ~/.codex/reply_cache/424242.md
```
*(注：424242 用来模拟 GUI 启动时使用的 pid 缓存键。)*

**Claude Code 调试**：
```bash
echo '{"hook_event_name":"Stop","session_id":"test-claude","last_assistant_message":"# Hello from Claude"}' | cliv cache-claude
cat ~/.claude/reply_cache/test-claude.md
```

**Gemini CLI 调试**：
```bash
echo '{"prompt_response":"# Hello from Gemini"}' | GEMINI_SESSION_ID=test-gemini cliv cache-gemini
cat ~/.gemini/reply_cache/test-gemini.md
```

如果手动执行上述命令后能成功将 `.md` 文件写入对应的 `reply_cache` 目录，说明 cliV 本身工作正常，问题极大概率出在 Agent 的 hook 配置文件路径或语法上。

### macOS 提示“已损坏，无法打开。您应该将它移到废纸篓”
这是因为通过网页下载的 GitHub Releases 产物会被 macOS 的 Gatekeeper 隔离（缺少 Apple 开发者签名和公证）。
**解决方法**：将 `cliV.app` 拖入“应用程序”(Applications) 文件夹，然后在终端运行以下命令移除隔离属性：
```bash
sudo xattr -rd com.apple.quarantine /Applications/cliV.app
```

## 6. 卸载

```bash
# 如果是下载的独立二进制放置于 ~/.local/bin
rm ~/.local/bin/cliv

# 如果用 deb 安装
sudo dpkg -r cliv

# 清理用户数据和缓存（可选）
rm -rf ~/.cliv
rm -rf ~/.codex/reply_cache
rm -rf ~/.claude/reply_cache
rm -rf ~/.gemini/reply_cache
```
