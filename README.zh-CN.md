# cliV

[![GitHub Stars](https://img.shields.io/github/stars/BobDLA/cliv?style=flat-square&logo=github&label=Stars)](https://github.com/BobDLA/cliv)
[![License](https://img.shields.io/github/license/BobDLA/cliv?style=flat-square)](https://github.com/BobDLA/cliv/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/BobDLA/cliv?style=flat-square&label=Release)](https://github.com/BobDLA/cliv/releases)

**[English](README.md)**

cliV 是一个面向长篇 AI Agent 回复的桌面审阅界面。你可以把它作为 `$EDITOR` 挂到 Codex、Claude Code、Gemini CLI 上，用来阅读富文本 Markdown、对精确段落做批注、聚合反馈，并通过直接写回或剪贴板把结果送回原工作流。

## 为什么需要 cliV

终端 Agent 很擅长生成长篇结构化回复，但并不适合精读。cliV 保留终端里的编码流程，只在需要仔细审阅时，把这一步切到更适合的桌面 GUI。

## 核心工作流

1. Agent hook 在每轮回复结束后调用 `cliv cache-codex`、`cliv cache-claude` 或 `cliv cache-gemini` 缓存回复。
2. Agent 触发 `$EDITOR` 进入审阅流程，常见是 `Ctrl+G`，具体取决于工具和配置。
3. cliV 加载最新回复，以 Markdown 方式渲染，并支持按选区添加批注。
4. cliV 聚合这些批注，并在有写回目标时直接写回；否则回退到剪贴板。

## cliV 能做什么

- 富文本 Markdown 审阅，支持标题、表格、代码块和 Mermaid 图
- 基于选区的批注，以及多批注聚合
- 有显式或受信写回目标时直接写回
- 没有写回目标时安全回退到剪贴板
- 独立打开本地 `.md`、`.markdown`、`.txt` 文件做审阅
- 将 cliV 自己的设置统一保存在 `~/.cliv/config.toml`

## 支持的 Agent

| Agent | Hook | 缓存命令 | 输入形式 |
|---|---|---|---|
| [Codex](https://github.com/openai/codex) | `notify` | `cliv cache-codex` | JSON 通过命令行参数传入 |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `Stop` | `cliv cache-claude` | JSON 通过 stdin 传入 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `AfterAgent` | `cliv cache-gemini` | JSON 通过 stdin 传入，外加 `GEMINI_SESSION_ID` |

## 安装

从 [GitHub Releases](https://github.com/BobDLA/cliv/releases) 下载最新产物即可。当前发布工作流会构建 Linux、macOS、Windows 三个平台的安装包或可执行产物。

如果需要从源码构建：

```bash
git clone https://github.com/BobDLA/cliv.git
cd cliv
pnpm install
pnpm tauri build
```

前置条件：Node.js 20+、Rust stable、pnpm。

## 快速设置

先把 cliV 设成你的编辑器：

```bash
export EDITOR="cliv"
```

然后为对应 Agent 配置 hook。详细步骤见 [docs/integrations.zh-CN.md](docs/integrations.zh-CN.md)。

## 启动语义

- `cliv file.md`：以审阅模式打开文件
- `cliv --target draft.md` 或 `cliv -t draft.md`：把 `draft.md` 作为显式写回目标
- `cliv --compose draft.md`：兼容旧调用方式，语义等同于 `--target`
- `CLIV_AGENT=codex|claude|gemini`：仅在你需要覆盖自动识别时使用

只有存在显式目标或命中受信调用方时，cliV 才会直接写回；否则会回退到剪贴板。

## 配置边界

cliV 自己的 durable settings 保存在 `~/.cliv/config.toml`，包括启动策略、Prompts、阅读偏好和受支持的应用内快捷键。Codex、Claude Code、Gemini CLI 的 hook 文件仍由各自工具管理，cliV 不会直接重写它们。

## 文档入口

- [概览与快速上手](docs/demo/overview-and-quickstart.zh-CN.md)
- [安装指南](docs/install-guide.zh-CN.md)
- [Agent 集成指南](docs/integrations.zh-CN.md)
- [归档问题与调研记录](docs/issues/)

## 开发

```bash
pnpm test
pnpm lint
pnpm typecheck
cargo test --manifest-path src-tauri/Cargo.toml
```

## 技术栈

- 前端：React 19、Vite 7、Zustand、TailwindCSS 4
- 后端：Tauri v2 + Rust
- 渲染：`react-markdown`、`remark-gfm`、Mermaid

## 许可证

MIT
