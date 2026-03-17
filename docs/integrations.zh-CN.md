# cliV：Agent 集成指南

**[English](integrations.md)**

本文档说明如何将 cliV 与 Codex、Claude Code 和 Gemini CLI 集成。

## 工作原理

> **💡 提示**：本节解释底部运行机制。如果只关心如何使用，**可以跳过此节，直接看 [配置步骤](#配置步骤)**。

cliV 是一个单一二进制文件，无需任何外部依赖（不需要 Python、Bash）。

1. **Agent hook** 在每次回复后调用 `cliv cache-xxx` → 缓存到磁盘
2. **你按下 Ctrl+G** → Agent 调用 `$EDITOR`（即 `cliv`）
3. **cliV** 自动检测是哪个 Agent 调用的，加载缓存的回复，打开 GUI

```
Agent 完成一次回复
    ↓ hook 触发
    cliv cache-codex / cache-claude / cache-gemini
    ↓ 写入 ~/.{agent}/reply_cache/{id}.md

你按下 Ctrl+G
    ↓ $EDITOR = cliv
    cliv --compose <file>
    ↓ 通过环境变量自动检测 Agent
    ↓ 加载缓存的回复
    cliV GUI 打开
```

---

## 配置步骤

### 第 1 步：安装

```bash
# 从 GitHub Release 下载
cp cliv ~/.local/bin/
# 或：sudo dpkg -i cliv_0.2.0_amd64.deb
```

### 第 2 步：设置 $EDITOR

```bash
# ~/.bashrc 或 ~/.zshrc
export EDITOR="cliv"
```

### 第 3 步：配置 Agent Hook

选择你使用的 Agent：

---

## Codex

在 `~/.codex/config.toml` 中添加：

```toml
# Linux / macOS (已配置软链接或 PATH)
notify = ["cliv", "cache-codex"]

# 🍏 macOS 最简配置（免软链接，直接粘贴绝对路径）
# notify = ["/Applications/cliV.app/Contents/MacOS/cliv", "cache-codex"]
```

**工作原理**：Codex 完成一轮对话后，调用 `cliv cache-codex '<json>'`，JSON 作为命令行参数传入。cliV 提取 `thread-id` 和 `last-assistant-message`，缓存到 `~/.codex/reply_cache/{thread-id}.md`。

### 提取回退链

1. **缓存命中**：`CODEX_THREAD_ID` → `~/.codex/reply_cache/{id}.md`
2. **SQLite 查询**：在 `~/.codex/state_5.sqlite` 中匹配 CWD
3. **JSONL 扫描**：在 `~/.codex/sessions/` 中查找最新文件

---

## Claude Code

在 `~/.claude/settings.json` 中添加：

> **🍏 macOS 免软链接提示**：如果你未配置环境变量，请将下方 JSON 中的 `"cliv cache-claude"` 替换为绝对路径：`"/Applications/cliV.app/Contents/MacOS/cliv cache-claude"`

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

**工作原理**：Claude 通过 stdin 管道传入 JSON，包含 `session_id` 和 `last_assistant_message`。cliV 缓存到 `~/.claude/reply_cache/{session-id}.md`。

### 提取回退链

1. **缓存命中**：`CLAUDE_SESSION_ID` → `~/.claude/reply_cache/{id}.md`
2. **会话记录扫描**：`~/.claude/transcripts/` 中最新的 JSONL 文件

---

## Gemini CLI

在 `~/.gemini/settings.json` 中添加：

> **🍏 macOS 免软链接提示**：如果你未配置环境变量，请将下方 JSON 中的 `"cliv cache-gemini"` 替换为绝对路径：`"/Applications/cliV.app/Contents/MacOS/cliv cache-gemini"`

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

**工作原理**：Gemini 通过 stdin 管道传入 JSON，包含 `prompt_response`。Session ID 来自 `GEMINI_SESSION_ID` 环境变量（由 Gemini 注入）。cliV 缓存到 `~/.gemini/reply_cache/{session-id}.md`。

### 提取回退链

1. **缓存命中**：`GEMINI_SESSION_ID` → `~/.gemini/reply_cache/{id}.md`
2. **文件扫描**：`~/.gemini/reply_cache/` 中最新的 `.md` 文件

---

## 补充说明

### 零依赖

cliV 是一个单一二进制文件。不需要 Python、Bash、Node.js 或任何包装脚本。

### Agent 自动检测

当作为 `$EDITOR` 启动时，cliV 通过环境变量（`CODEX_THREAD_ID`、`CLAUDE_SESSION_ID`、`GEMINI_SESSION_ID`）自动检测调用的 Agent。除非你想手动覆盖，否则不需要设置 `CLIV_AGENT` 环境变量。

### 提取优先级

当 Agent 未知时，cliV 按以下顺序尝试：**Claude → Gemini → Codex**。

> **为什么？** Codex 的回退扫描器总是会返回 _某些内容_（即使是过期数据），所以放在最后，避免遮盖更新的回复。
