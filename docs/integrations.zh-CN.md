# cliV 高级集成与调试参考

**[English](integrations.md)**

请先按 [安装指南](install-guide.zh-CN.md) 完成正式安装。
这份文档只处理进阶场景：

- 非默认可执行路径
- `$EDITOR` 启动行为
- 跨平台 hook 适配
- reply cache 查找规则
- 手工调试

## 1. 先确定命令路径

不同平台推荐使用的 hook / `$EDITOR` 命令如下：

| 平台 | hooks 和 `$EDITOR` 推荐写法 | 说明 |
|---|---|---|
| Linux | `cliv` | 官方 `.deb` 会把 `cliv` 安装到 `/usr/bin/cliv`。 |
| Windows | `cliv` | `-setup.exe` 安装器会把 `%LOCALAPPDATA%\\cliv` 加入当前用户 `PATH`。安装或更新后需要重开终端。 |
| macOS | `/Applications/cliV.app/Contents/MacOS/cliv` | `.app` 不会自动进 `PATH`。如果你手动创建过软链接，也可以继续写 `cliv`。 |

如果 cliV 不在 `PATH` 中，请把下面所有 `cliv` 替换成完整可执行路径。

## 2. 理解启动语义

cliV 支持几种典型调用形态：

- `cliv review.md`
  把 `review.md` 作为审阅内容打开，不自动把它当成写回目标。
- `cliv --target draft.md` 或 `cliv -t draft.md`
  把 `draft.md` 作为显式写回目标。
- `cliv --compose draft.md`
  与 `--target` 等价，只是兼容旧调用方式。
- trusted caller 触发的 `cliv <file>`
  如果受信调用方只传了一个位置参数，cliV 会把它视为旧式 `$EDITOR` 流程里的写回目标。

如果没有检测到 Agent，cliV 会直接跳过 reply extraction，保持 fail-closed，不会自行猜测。

## 3. 可选：cliV 自己的配置文件

大多数用户可以跳过这一节。

cliV 自己的持久化配置保存在 `~/.cliv/config.toml`。设置面板会写这个文件；Codex / Claude / Gemini 的 hook 文件不在这个边界内，cliV 不会直接重写它们。

与集成最相关的通常是：

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

Prompts、UI 偏好、Shortcuts 也都在这个文件里，但通常更适合直接在 cliV 设置面板里修改。

## 4. Hook 参考

下面的片段和安装指南里的正式写法一致，这里重复保留，是为了便于你在“非默认路径”场景下做改写。

### Codex

`~/.codex/config.toml`：

```toml
notify = ["cliv", "cache-codex"]
```

macOS 未创建软链接：

```toml
notify = ["/Applications/cliV.app/Contents/MacOS/cliv", "cache-codex"]
```

Codex 会把 JSON 作为命令行参数传给 `cliv cache-codex`。

保留该 notify 配置用于兼容，再添加 `~/.codex/hooks.json`，让 Plan Review 回复通过 stdin 传入：

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

当前 Codex 的 Plan Review 可能让两个 assistant-message 字段都为 `null`。此时 cliV 只读取 Stop Hook 提供的 `transcript_path` 中同 session、同 turn 的 `item_completed/Plan` 条目；用户不需要执行额外命令。

请在 Codex 中通过 `/hooks` 审核并信任该命令。如果同一个配置层已经使用 inline Hooks，请把这个 handler 合并进去，不要同时保留 inline Hooks 和 `hooks.json`。macOS 未创建软链接时，command 使用 `/Applications/cliV.app/Contents/MacOS/cliv cache-codex`。

### Claude Code

`~/.claude/settings.json`：

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

macOS 未创建软链接：

- 把 `cliv cache-claude` 改成 `/Applications/cliV.app/Contents/MacOS/cliv cache-claude`

Claude 会通过 stdin 管道传入包含 `session_id` 和 `last_assistant_message` 的 JSON。

### Gemini CLI

`~/.gemini/settings.json`：

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

macOS 未创建软链接：

- 把 `cliv cache-gemini` 改成 `/Applications/cliV.app/Contents/MacOS/cliv cache-gemini`

Gemini 会通过 stdin 管道传入包含 `prompt_response` 的 JSON。

## 5. Reply Cache 查找规则

cliV 只会运行“已检测到的那个 Agent”对应的 extractor。

### Codex

reply cache 查找顺序：

1. PID 缓存命中：`CODEX_THREAD_ID` -> `~/.codex/reply_cache/{pid}.md`
2. 元数据匹配：查找 `reply_cache/*.meta.json` 中 `real_session_id` 命中的最新记录
3. 传统直读：`~/.codex/reply_cache/{thread-id}.md`

### Claude Code

reply cache 查找顺序：

1. 直接缓存命中：`CLAUDE_SESSION_ID` -> `~/.claude/reply_cache/{key}.md`
2. 元数据匹配：查找 `reply_cache/*.meta.json` 中 `key`、`real_session_id` 或 `pid` 命中的最新记录
3. 兼容直读：读取同一个 key 的 legacy 直存文件

### Gemini CLI

reply cache 查找顺序：

1. 直接缓存命中：`GEMINI_SESSION_ID` -> `~/.gemini/reply_cache/{key}.md`
2. 元数据匹配：查找 `reply_cache/*.meta.json` 中 `key`、`real_session_id` 或 `pid` 命中的最新记录
3. 兼容直读：读取同一个 key 的 legacy 直存文件

## 6. 手工调试

### Shell 说明

下面的示例默认使用类 Unix shell。
如果你在 Windows PowerShell 里执行，需要做两类替换：

- `VAR=value cmd` -> `$env:VAR = 'value'; cmd`
- `cat file` -> `Get-Content file`

如果你使用 Git Bash 或 WSL，也可以直接照抄这些示例。

### 验证二进制解析

Linux / macOS 且 `PATH` 正常：

```bash
which cliv
cliv --help
```

macOS 未创建软链接：

```bash
/Applications/cliV.app/Contents/MacOS/cliv --help
```

Windows：

```powershell
where.exe cliv
cliv --help
```

### 手工验证 Hook 输出

Codex：

```bash
CODEX_THREAD_ID=424242 cliv cache-codex '{"type":"agent-turn-complete","thread-id":"test-123","last-assistant-message":"# Hello\nTest reply."}'
cat ~/.codex/reply_cache/424242.md

printf '%s' '{"hook_event_name":"Stop","session_id":"test-123","turn_id":"plan-1","permission_mode":"plan","last_assistant_message":"<proposed_plan>\n# Plan\n\n- Review this\n</proposed_plan>"}' | CODEX_THREAD_ID=424242 cliv cache-codex
cat ~/.codex/reply_cache/424242.md
```

Claude Code：

```bash
echo '{"hook_event_name":"Stop","session_id":"test-claude","last_assistant_message":"# Hello from Claude"}' | cliv cache-claude
cat ~/.claude/reply_cache/test-claude.md
```

Gemini CLI：

```bash
echo '{"prompt_response":"# Hello from Gemini"}' | GEMINI_SESSION_ID=test-gemini cliv cache-gemini
cat ~/.gemini/reply_cache/test-gemini.md
```

如果这些命令已经能写出正确的 `.md` 文件，就说明 cliV 本身工作正常，剩下的问题通常在这里：

- hook 文件路径写错了
- JSON / TOML 语法有误
- Codex Stop Hook 尚未通过 `/hooks` 信任
- Codex 的 `features.hooks` 设置禁用了 Hooks
- shell 引号转义不对
- 终端仍然是旧会话，没有重新加载 `PATH` 或 `EDITOR`

### cliV 打开了，但没有显示回复

按这个顺序排查：

1. 当前启动时，是否检测到了正确的 Agent？
2. 对应 `~/.codex`、`~/.claude`、`~/.gemini` 下是否真的写出了 cache 文件？
3. 当前启动上下文里，cliV 查找的 lookup key 是否和你预期一致？
4. 是否因为非默认路径或 shell 引号问题，导致 hook 根本没执行？
5. Codex Plan Review 场景下，`/hooks` 是否显示 Stop Hook 已受信任？
6. Windows 上是否在安装或修改 `EDITOR` 之后重新打开了终端？
