## Why

当前 cliV 支持即时批注和提交，但提交后的历史能力仍然缺少稳定契约：前端历史列表还停留在本地 MVP，会话落盘与实际批注/提交快照没有统一归档，用户也无法按项目回看“当时的原文 + 高亮 + 评论现场”。随着多个项目并行使用，缺少项目分组和一致的归档结构会让历史记录很快失去可检索性。

## What Changes

- 在用户提交反馈后生成只读历史归档，统一落到 `~/.cliv/history/archive/`，并按项目维度分组。
- 以 cliV 启动时的当前工作目录作为 `workspace.path`，用于归档分组与历史列表展示。
- 为每次提交保存稳定快照文件：`meta.json`、`reply.md`、`annotations.json`、`submission.json`，以及在需要时保存 `target.before.md`。
- 在现有历史侧栏中按项目分组展示归档列表，并在打开历史时恢复只读的原文、高亮与评论现场。
- 历史功能保持基于目录结构与 JSON/Markdown 快照实现，不引入本地数据库。

## Capabilities

### New Capabilities
- `project-review-history`: Covers project-grouped review archives, summary browsing, search, and read-only replay of submitted reviews.

### Modified Capabilities
- None.

## Impact

- Frontend UI: 左侧历史列表、历史搜索、历史详情的只读回放。
- Frontend services/stores: 提交流程、历史摘要读取、归档详情恢复。
- Tauri/Rust backend: 启动上下文中的 `workspace.path` 采集、归档目录结构、文件读写命令。
- Persistent file format: `~/.cliv/history/archive/` 下的新目录结构和 JSON/Markdown 快照文件。
- Docs: 需要同步公开说明中与历史归档、提交后行为相关的文档。
