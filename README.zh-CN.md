# cliV

[![GitHub Stars](https://img.shields.io/github/stars/BobDLA/cliv?style=flat-square&logo=github&label=Stars)](https://github.com/BobDLA/cliv)
[![License](https://img.shields.io/github/license/BobDLA/cliv?style=flat-square)](https://github.com/BobDLA/cliv/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/BobDLA/cliv?style=flat-square&label=Release)](https://github.com/BobDLA/cliv/releases)

**[English](README.md)**

**cliV** — 从命令行启动的桌面审阅器，用来阅读长篇 AI Agent 回复和 Markdown 草稿。
阅读、批注，然后在有显式或受信写回目标时直接写回；没有时复制结果继续发送。

<!-- TODO: 添加截图 -->
<!-- ![cliV 截图](docs/media/hero.png) -->

## 为什么需要 cliV？

AI 编程 Agent（Codex、Claude Code、Gemini CLI）经常产出长篇结构化回复——但你只能在终端里阅读。20 行还行，500 行就很痛苦了。

当你的 Agent 调用 `$EDITOR` 时（常见是 `Ctrl+G`，但取决于 Agent 和配置），**cliV** 会打开一个更适合审阅的桌面界面：

- **审阅** — 完整的 Markdown + Mermaid 图表渲染，告别纯文本
- **批注** — 精确选中段落添加评论，不再写模糊的追问
- **写回** — 有写回目标时直接写回，没有时回退到剪贴板
- **打开** — 也可以直接打开本地 Markdown 文件做独立审阅

## 支持的 Agent

| Agent | 集成方式 | Hook 命令 |
|---|---|---|
| [Codex](https://github.com/openai/codex) | `notify` hook | `cliv cache-codex` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `Stop` hook | `cliv cache-claude` |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `AfterAgent` hook | `cliv cache-gemini` |

`cache-codex` 通过命令行参数接收 JSON；`cache-claude` 和 `cache-gemini` 通过 stdin 读取 JSON。Gemini 还依赖 `GEMINI_SESSION_ID`。

## 安装

### 下载安装（推荐）

从 [GitHub Releases](https://github.com/BobDLA/cliv/releases) 获取最新版本：

- **Linux**：`.deb` 包或独立二进制文件

```bash
# 安装 .deb 包
sudo dpkg -i cliv_0.2.1_amd64.deb

# 或直接拷贝二进制到 PATH
cp cliv ~/.local/bin/
```

### 从源码构建

```bash
# 前置条件：Node.js 20+、Rust 1.75+、pnpm
git clone https://github.com/BobDLA/cliv.git
cd cliv
pnpm install
pnpm tauri:build
# 本地打包命令；在 Linux 上默认走 deb-only 配置
# 二进制位于 src-tauri/target/release/cliv
```

如果要模拟发版链路或自定义 bundle 目标，使用 `pnpm tauri:build:release -- --bundles deb`，也可以按需传入其他 Tauri 构建参数。

### 设置 `$EDITOR`

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
export EDITOR="cliv"
```

默认保持 `cliv` 即可；如果调用方支持显式参数，也可以传 `--target <file>`。然后配置 Agent Hook —— 详见 [docs/integrations.zh-CN.md](docs/integrations.zh-CN.md)。

## 快速上手

1. 启动你的 AI Agent（Codex、Claude Code 或 Gemini CLI）
2. 进行一轮对话，让 Agent 产生长回复
3. 触发 Agent 的 `$EDITOR` 流程（常见是 `Ctrl+G`，但取决于 Agent / 配置）
4. cliV 弹出窗口，展示 Agent 最新回复的富文本渲染
5. 选中文本 → 添加批注 → 汇总 → 写回或复制结果

## 功能特性

- 📖 **富文本 Markdown 渲染** — 标题、代码块、表格、Mermaid 图表
- ✏️ **基于选区的批注** — 高亮段落并添加评论（正文高亮依赖 CSS Highlight API）
- 📋 **写回流程** — 将批注汇总为提示词，然后写回或复制
- 🔄 **多 Agent 支持** — 尽力自动识别 Codex / Claude / Gemini，也可用 `CLIV_AGENT` 强制指定
- 📂 **打开本地 Markdown** — 既能审阅缓存回复，也能直接打开 `.md` 文件，且默认按只读审阅处理
- 🎛️ **统一设置** — 在同一个设置面板中管理 Reading、Prompts、Shortcuts、Integrations，并统一持久化到 `~/.cliv/config.toml`

## 说明

- **启动语义** — `cliv <file.md>` 会把文件当作审阅内容打开；`cliv --target <file>`、`cliv -t <file>` 和兼容别名 `cliv --compose <file>` 会把文件当作写回目标。
- **写回行为** — 只有存在显式目标或命中受信调用方时，cliV 才会直接写回；否则回退到剪贴板。
- **本地存储** — 集成 hook 会把回复缓存在各 Agent 的 `reply_cache` 目录下；会话数据目前也只保存在本地。
- **贡献者文档** — 架构总览见 [docs/demo/demo.md](docs/demo/demo.md)，验证规则见 [docs/testing-standard.md](docs/testing-standard.md)，构建/打包路径见 [docs/build-workflows.md](docs/build-workflows.md)，共享 worktree cache 说明见 [docs/worktree-cache.md](docs/worktree-cache.md)，重构范围规范见 [docs/refactoring_governance.md](docs/refactoring_governance.md)，本轮 backlog 见 [docs/refactor-backlog.md](docs/refactor-backlog.md)，session / history 共享恢复边界见 [docs/session-history-boundary.md](docs/session-history-boundary.md)。
- **设置边界** — cliV 自己的 durable settings 统一保存在 `~/.cliv/config.toml`，包括 launch policy、prompt headers、阅读偏好和受支持的应用级快捷键。外部 hook 文件仍归各 agent CLI 自己管理。
- **自动识别** — Agent 识别依赖环境变量和进程启发式；如需强制指定，可设置 `CLIV_AGENT=codex|claude|gemini`。受信调用方、忽略调用方、扫描深度、prompt headers 和受支持的 settings-backed shortcuts 都可在 `~/.cliv/config.toml` 中配置。
- **日志** — 在非 Windows 系统上，cliV 可能会把诊断日志写到 `~/.cliv/cliv.log`。

### `~/.cliv/config.toml` 示例

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

[prompts]
reply_header_zh = "请基于以下批注逐条回应。请以 Markdown 格式返回。"
reply_header_en = "Please respond to each annotation below in Markdown."
iterate_header_zh = "请根据以下批注，对原文进行增量修改。"
iterate_header_en = "Please make incremental revisions based on the following annotations."

[ui]
theme = "light"
font_size = 18
locale = "en"
sidebar_open = true
sidebar_tab = "outline"
sidebar_width = 224
annotation_margin_width = 256
content_width = "standard"
page_padding = "comfortable"
reading_density = "comfortable"
highlight_strength = "balanced"

[ui.shortcuts]
open_file = "Mod+O"
search = "Mod+F"
submit_return = "Mod+Enter"
submit_annotation = "Mod+Enter"
add_annotation = "Mod+Alt+M"
font_increase = "Mod+="
font_decrease = "Mod+-"
font_reset = "Mod+0"
```

当 `submit_annotation` 与 `submit_return` 共用 `Mod+Enter` 时，cliV 会按焦点优先级处理：批注编辑器处于活动提交上下文时优先提交批注，否则同一按键会落到整体 return 提交。

## 技术栈

- **前端**：React 19 + Vite 7 + Zustand + TailwindCSS 4
- **后端**：Tauri v2（Rust）
- **渲染**：react-markdown + remark-gfm + Mermaid

## 路线图

- [ ] 大文档虚拟滚动
- [ ] Diff / 建议模式
- [x] 独立审阅完善（`cliv <file.md>` 默认只读审阅，支持安全回退）
- [x] 跨平台构建（macOS、Windows）
- [ ] 自定义 Agent 插件系统
- [x] 审阅历史（按项目分组归档，并支持只读回放）
- [ ] 收藏夹
- [ ] 迭代编辑模式

## 许可证

MIT
