# cliV

**[English](README.md)**

**cliV** — 在命令行中触发的 AI Agent 回复 GUI 审阅器。
阅读、批注，并将结构化反馈直接返回到当前对话线程。

<!-- TODO: 添加截图 -->
<!-- ![cliV 截图](docs/media/hero.png) -->

## 为什么需要 cliV？

AI 编程 Agent（Codex、Claude Code、Gemini CLI）经常产出长篇结构化回复——但你只能在终端里阅读。20 行还行，500 行就很痛苦了。

按下 `Ctrl+G`，**cliV** 给你一个真正的 GUI：

- **审阅** — 完整的 Markdown + Mermaid 图表渲染，告别纯文本
- **批注** — 精确选中段落添加评论，不再写模糊的追问
- **返回** — 一键将结构化反馈发回当前线程

## 支持的 Agent

| Agent | 集成方式 | Hook 命令 |
|---|---|---|
| [Codex](https://github.com/openai/codex) | `notify` hook | `cliv cache-codex` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `Stop` hook | `cliv cache-claude` |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `AfterAgent` hook | `cliv cache-gemini` |

## 安装

### 下载安装（推荐）

从 [GitHub Releases](https://github.com/BobDLA/cliv/releases) 获取最新版本：

- **Linux**：`.deb` 包或独立二进制文件

```bash
# 安装 .deb 包
sudo dpkg -i cliv_0.2.0_amd64.deb

# 或直接拷贝二进制到 PATH
cp cliv ~/.local/bin/
```

### 从源码构建

```bash
# 前置条件：Node.js 20+、Rust 1.75+、pnpm
git clone https://github.com/BobDLA/cliv.git
cd cliv
pnpm install
pnpm tauri build
# 二进制位于 src-tauri/target/release/cliv
```

### 设置 `$EDITOR`

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
export EDITOR="cliv"
```

然后配置 Agent Hook —— 详见 [docs/integrations.zh-CN.md](docs/integrations.zh-CN.md)。

## 快速上手

1. 启动你的 AI Agent（Codex、Claude Code 或 Gemini CLI）
2. 进行一轮对话，让 Agent 产生长回复
3. 按下 `Ctrl+G`
4. cliV 弹出窗口，展示 Agent 最新回复的富文本渲染
5. 选中文本 → 添加批注 → 汇总 → 将反馈返回线程

## 功能特性

- 📖 **富文本 Markdown 渲染** — 标题、代码块、表格、Mermaid 图表
- ✏️ **基于选区的批注** — 高亮段落并添加评论
- 📋 **结构化反馈** — 将批注汇总为提示词，返回给 Agent
- 🔄 **多 Agent 支持** — 自动识别 Codex / Claude / Gemini
- 📂 **会话历史** — 本地持久化历史审阅记录
- 🌙 **主题切换** — 亮色 / 暗色模式
- 🔍 **字体缩放** — 调整阅读舒适度

## 技术栈

- **前端**：React 19 + Vite 7 + Zustand + TailwindCSS 4
- **后端**：Tauri v2（Rust）
- **渲染**：react-markdown + remark-gfm + Mermaid

## 路线图

- [ ] 大文档虚拟滚动
- [ ] Diff / 建议模式
- [ ] 独立审阅模式（打开任意 `.md` 文件）
- [ ] 跨平台构建（macOS、Windows）
- [ ] 自定义 Agent 插件系统

## 许可证

MIT
