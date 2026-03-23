# cliV 安装与配置指南

**[English](install-guide.md)**

## 1. 构建

```bash
cd cliv
pnpm install
pnpm tauri:build
```

构建产物：
- **二进制**：`src-tauri/target/release/cliv`
- **deb 包**：`src-tauri/target/release/bundle/deb/cliv_0.2.1_amd64.deb`

`pnpm tauri:build` 现在是本地打包路径。在 Linux 上它会额外加载一个 deb-only 的 Tauri 覆盖配置，避免日常调试时顺手生成多余 bundle。需要按发版方式打包时，使用 `pnpm tauri:build:release -- <tauri 参数>`。

## 2. 安装

根据你的系统选择一种方式：

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

### 验证
```bash
cliv --help  # 或 which cliv
```

## 3. 设置环境变量

编辑 `~/.bashrc` 或 `~/.zshrc`：

```bash
export EDITOR="cliv"
```

然后 `source ~/.bashrc`（或重启终端）。

> **原理**：当 AI agent 触发 Ctrl+G 时，它会调用 `$EDITOR`。设成 `cliv` 后，agent 会直接启动 cliV。
> `cliv file.md` 默认是只读审阅；如需显式写回目标，可用 `cliv --target file.md`（兼容别名：`--compose`）。

## 4. 配置 Agent Hook

每个 agent 需要一行 hook 配置，让它在回复完成后调用 `cliv cache-xxx` 缓存回复。

---

### 4a. Codex

编辑 `~/.codex/config.toml`，添加：

```toml
notify = ["cliv", "cache-codex"]
```

**完整示例**（如果文件不存在就新建）：

```toml
# ~/.codex/config.toml
model = "o4-mini"
notify = ["cliv", "cache-codex"]
```

**测试**：
```bash
# 手动测试 cache-codex
CODEX_THREAD_ID=424242 cliv cache-codex '{"type":"agent-turn-complete","thread-id":"test-123","last-assistant-message":"# Hello\nTest reply."}'
cat ~/.codex/reply_cache/424242.md
cat ~/.codex/reply_cache/424242.meta.json
# 这里的 424242 用来模拟 GUI 启动时使用的 pid 缓存键。
```

**真实测试**：
1. 启动 Codex → 进行一轮对话
2. 按 `Ctrl+G`
3. cliV 应弹出并显示 AI 最新回复

---

### 4b. Claude Code

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

**测试**：
```bash
# 手动测试 cache-claude
echo '{"hook_event_name":"Stop","session_id":"test-456","last_assistant_message":"# Hello from Claude"}' | cliv cache-claude
cat ~/.claude/reply_cache/test-456.md
```

**真实测试**：
1. 启动 Claude Code → 进行一轮对话
2. 按 `Ctrl+G`
3. cliV 应弹出并显示 Claude 最新回复

---

### 4c. Gemini CLI

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

**测试**：
```bash
# 手动测试 cache-gemini
echo '{"prompt_response":"# Hello from Gemini"}' | GEMINI_SESSION_ID=test-789 cliv cache-gemini
cat ~/.gemini/reply_cache/test-789.md
```

**真实测试**：
1. 启动 Gemini CLI → 进行一轮对话
2. 按 `Ctrl+G`（需要 $EDITOR 支持后）
3. cliV 应弹出并显示 Gemini 最新回复

---

## 5. 验证清单

| 步骤 | 命令 | 预期 |
|---|---|---|
| 二进制存在 | `which cliv` | 显示路径 |
| EDITOR 设置 | `echo $EDITOR` | `cliv` |
| Codex hook 配置 | `cat ~/.codex/config.toml` | 含 `notify = ["cliv", "cache-codex"]` |
| Claude hook 配置 | `cat ~/.claude/settings.json` | 含 `"command": "cliv cache-claude"` |
| Codex cache 测试 | 上面的手动命令 | 缓存和元数据写入成功 |
| Claude cache 测试 | 上面的手动命令 | 文件写入成功 |
| Ctrl+G 真实测试 | 在 agent 中按 Ctrl+G | cliV 窗口弹出 |

## 6. 常见问题 (FAQ)

### macOS 提示“已损坏，无法打开。您应该将它移到废纸篓”
这是因为通过网页下载的 GitHub Releases 产物会被 macOS 的 Gatekeeper 隔离（缺少 Apple 开发者签名和公证）。
**解决方法**：将 `cliV.app` 拖入“应用程序”(Applications) 文件夹，然后在终端运行以下命令移除隔离属性：
```bash
sudo xattr -rd com.apple.quarantine /Applications/cliV.app
```

## 7. 卸载

```bash
# 如果用方式 A 安装
rm ~/.local/bin/cliv

# 如果用 deb 安装
sudo dpkg -r cliv

# 清理用户数据和缓存（可选）
rm -rf ~/.cliv
rm -rf ~/.codex/reply_cache
rm -rf ~/.claude/reply_cache
rm -rf ~/.gemini/reply_cache
```
