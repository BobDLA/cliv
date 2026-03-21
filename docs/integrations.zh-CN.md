# cliV：Agent 集成指南

**[English](integrations.md)**

本文档说明如何将 cliV 与 Codex、Claude Code 和 Gemini CLI 集成。

## 工作原理

> **💡 提示**：本节解释底部运行机制。如果只关心如何使用，**可以跳过此节，直接看 [配置步骤](#配置步骤)**。

cliV 是一个单一二进制文件，无需任何外部依赖（不需要 Python、Bash）。

1. **Agent hook** 在每次回复后调用 `cliv cache-xxx` → 缓存到磁盘
2. **你按下 Ctrl+G** → Agent 调用 `$EDITOR`（通常就是 `cliv`）
3. **cliV** 自动检测是哪个 Agent 调用的，并结合显式参数或受信调用方规则决定写回目标，再打开 GUI

```
Agent 完成一次回复
    ↓ hook 触发
    cliv cache-codex / cache-claude / cache-gemini
    ↓ 写入 ~/.{agent}/reply_cache/<cache-key>.md

你按下 Ctrl+G
    ↓ $EDITOR = cliv
    cliv <file>                 # 兼容旧式调用
    或 cliv --target <file>     # 调用方支持显式参数时推荐
    ↓ 通过环境变量自动检测 Agent
    ↓ 通过显式参数或 trusted caller 规则解析写回目标
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

如果你的调用方支持传额外参数，也可以显式使用：

```bash
export EDITOR="cliv --target"
```

如果调用方只能传 `cliv <file>`，cliV 会在命中受信调用方时把这个位置参数当成写回目标；普通独立打开则保持为只读审阅模式。

### 可选：配置 trusted caller 与提示词模板

编辑 `~/.cliv/config.toml`：

```toml
[launch]
scan_depth = 5
trusted_callers = ["codex", "claude", "gemini"]
ignored_callers = ["bash", "zsh", "fish", "tmux", "launchd", "open"]

[prompts]
reply_header_zh = "请基于以下批注逐条回应。请以 Markdown 格式返回。"
reply_header_en = "Please respond to each annotation below in Markdown."
iterate_header_zh = "请根据以下批注，对原文进行增量修改。"
iterate_header_en = "Please make incremental revisions based on the following annotations."
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

**工作原理**：Codex 完成一轮对话后，会调用 `cliv cache-codex '<json>'`，JSON 作为命令行参数传入。cliV 提取 `thread-id` 和 `last-assistant-message`，检测当前 Codex 进程 PID，把正文写到 `~/.codex/reply_cache/{pid}.md`，并把真实 thread ID 写进 `~/.codex/reply_cache/{pid}.meta.json`。

### 提取回退链

1. **PID 缓存命中**：`CODEX_THREAD_ID`（保留的兼容变量名，实际通常承载当前 Codex 的 PID 缓存键）→ `~/.codex/reply_cache/{pid}.md`
2. **元数据匹配**：查找 `reply_cache/*.meta.json` 中 `real_session_id` 等于查找键的最新记录
3. **传统缓存命中**：直接匹配 `~/.codex/reply_cache/{thread-id}.md`

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

当作为 `$EDITOR` 启动时，cliV 会通过环境变量（`CODEX_THREAD_ID`、`CLAUDE_SESSION_ID`、`GEMINI_SESSION_ID`）自动检测调用的 Agent。对于 Codex，`CODEX_THREAD_ID` 这个名字出于兼容性保留，但实际用于缓存查找的值通常是当前 agent 的 PID。除非你想手动覆盖，否则不需要设置 `CLIV_AGENT` 环境变量。

### 启动模式

- `cliv file.md`：把 `file.md` 当作审阅内容打开，不直接写回这个文件。
- `cliv --target draft.md` / `cliv -t draft.md`：把 `draft.md` 作为显式写回目标。
- `cliv --compose draft.md`：兼容旧调用方式，语义等同于 `--target`。
- 若命中 `trusted_callers` 且只收到一个位置参数：该参数会被视为写回目标，用于兼容只会调用 `cliv <file>` 的 CLI。

### 提取优先级

当 Agent 未知时，cliV 按以下顺序尝试：**Claude → Gemini → Codex**。

> **为什么？** Codex 的回退扫描器总是会返回 _某些内容_（即使是过期数据），所以放在最后，避免遮盖更新的回复。
