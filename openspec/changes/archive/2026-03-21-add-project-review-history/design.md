## Context

当前 cliV 在“即时审阅”这条链路上已经具备原文查看、批注、汇总与提交能力，但历史能力仍然是分裂的：一方面有前端 `localStorage` 的 session MVP，另一方面后端已经开始引入更稳定的文件落盘；两者都没有形成“提交后可回看”的项目级归档契约。与此同时，最终提交内容并不只是批注列表，还会受到模板模式、自由输入和目标文本种子的影响，因此仅靠重新拼接批注无法可靠重建“当时到底发出了什么”。

这个变化跨越启动上下文、提交流程、文件持久化、历史列表和详情回放，是一个典型的跨模块边界整理问题，适合先固定设计再实现。

## Goals / Non-Goals

**Goals:**
- 在提交成功后生成稳定、只读、可回放的历史归档。
- 按项目维度组织历史记录，避免多个项目混在一起。
- 打开历史时恢复归档时的 `reply.md` 正文、高亮和评论卡片。
- 用目录结构与 JSON/Markdown 文件作为历史真源，不引入数据库。
- 保留足够的提交快照信息，让归档能够精确说明“当时提交了什么”。

**Non-Goals:**
- 不支持在 archive 上继续评论或继续会话。
- 不在 v1 推断 repo root、项目名称或更复杂的 workspace fallback。
- 不引入 SQLite、全文索引或额外后台进程。
- 不强制大改现有三栏布局，只在现有历史入口内做项目分组和归档回放。

## Decisions

### 1. `workspace.path` 使用启动时的当前工作目录

归档的项目主键定义为 cliV 启动时看到的当前工作目录，做规范化后保存为 `workspace.path`。  

Why:
- 当前各 agent hook 并不稳定提供项目名或 repo 根目录。
- Rust 启动阶段天然能拿到当前工作目录，比依赖前端、缓存 sidecar 或额外 metadata 更稳。
- 先把“当前工作目录”作为项目边界固定下来，能在 v1 提供简单且一致的行为。

Alternatives considered:
- 推断 repo root：更像“项目”，但需要 Git/FS 额外探测，失败路径更多。
- 依赖 agent-specific metadata：现有 Claude/Gemini hook 不提供足够稳定的项目字段。
- 使用 review/target 文件路径：会把同一项目里的不同文件拆散，不适合做项目分组。

### 2. 提交成功即创建只读 archive

归档触发点统一定义为“提交成功”：
- 写文件成功时归档；
- review-only 或写文件失败后 clipboard fallback 成功时也归档；
- 如果文件写入和 clipboard 都失败，则不创建部分归档。

Why:
- 用户当前只需要一个动作，不需要“完成审阅”这样的第二套工作流。
- “提交成功”是最清晰的业务边界，也最适合绑定归档快照。
- 避免把尚未提交或失败的临时状态污染历史列表。

Alternatives considered:
- 手动“完成审阅”：增加流程复杂度，与当前产品状态不匹配。
- 首次批注时落 draft 再迁移到 archive：更完整，但 v1 成本过高。

### 3. 历史持久化使用按项目分组的文件系统结构

归档真源使用文件系统目录，不使用数据库。目录结构为：

```text
~/.cliv/history/archive/
  <workspace-key>/
    workspace.json
    <year>/
      <month>/
        <archive-id>/
          meta.json
          reply.md
          annotations.json
          submission.json
          target.before.md   # optional
```

其中：
- `workspace-key` 是由规范化后的 `workspace.path` 派生的稳定目录键；
- `workspace.json` 保存项目级固定信息；
- 每次提交都是一个独立的 archive 目录。

Why:
- 目录结构天然适合本地备份、调试和手工检查。
- 项目维度在数据层而不是仅在 UI 层表现出来，后续扩展更稳。
- 现在的数据量预期较小，优先清晰性而不是索引优化。

Alternatives considered:
- 统一平铺在年月目录下：跨项目混排，后续列表整理会越来越乱。
- SQLite / 其他数据库：会引入额外复杂度，而 v1 没有必要。

### 4. `submission.json` 保存真实提交输入和输出

除 `reply.md` 与 `annotations.json` 外，archive 还要保存 `submission.json`，最少包括：
- `createdAt`
- `method`
- `templateMode`
- `userText`
- `finalOutput`

若生成逻辑依赖了已有目标内容，再额外保存 `target.before.md`。

Why:
- 最终提交内容不仅由批注决定，还会受模板模式、自由输入和目标种子文本影响。
- 仅靠重新拼接批注无法保证 100% 重建当时的提交结果。
- 把真实输入与最终输出一并落盘，能让 archive 更可信、更可解释。

Alternatives considered:
- 只存 `finalOutput`：可回看结果，但缺少形成过程。
- 完全不存 submission：对“当时到底发了什么”缺少稳定答案。

### 5. 历史浏览复用现有三栏骨架，archive 详情只读

v1 保持当前总体布局：
- 左侧：History，按项目分组展示 archive 列表与搜索结果；
- 中间：归档的 `reply.md` 正文；
- 右侧：归档的评论卡片。

archive 打开后是只读回放：
- 恢复高亮与评论位置；
- 不修改 archive 文件；
- 不提供“继续评论”。

列表项摘要统一显示：
- 时间
- 提交字数
- 条数

例如：`03-22 14:31 · 428字 · 6条`

Why:
- 当前三栏结构已经贴近“原文 + 评论”的目标，不需要大改布局。
- “reply.md” 文件名高度重复，不适合作为主标签；时间、字数、条数更有信息密度。
- “条数”只做粗粒度摘要，避免为统计逻辑引入复杂分支。

Alternatives considered:
- 独立项目列的新布局：信息更清楚，但对现有 UI 侵入更大。
- 仅展示批注数或仅展示文件名：对自由输入和多条同名回复都不够友好。

## Risks / Trade-offs

- `[workspace.path 可能是子目录而非 repo root]` → v1 明确把它定义为“当前工作目录”，不再额外推断；如果后续需要 repo root，可单独扩展。
- `[文件系统扫描成本会随 archive 增长]` → `workspace.json` 和 `meta.json` 保持轻量；如果未来出现性能问题，再增加缓存索引而不是一开始上数据库。
- `[“条数”中的自由输入识别可能不稳定]` → 将其定义为粗略摘要；实现上优先简单，不做复杂语义判断。
- `[现有 localStorage session MVP 与新 archive 会并存一段时间]` → v1 不做历史数据回填；新提交只写新 archive，旧 session 作为独立遗留数据处理。

## Migration Plan

- 该变更是新增目录与归档格式，不覆盖现有用户文件。
- 新版本开始仅为新的成功提交生成 archive；不强制迁移已有 session 或旧历史。
- 如果需要回滚，保留 `~/.cliv/history/archive/` 目录即可，不影响已有 review/source 文件。

## Open Questions

- v1 是否在历史详情页显式展示 `submission.json` 的内容，还是先仅作为归档数据保留并通过次级动作访问。该问题不阻塞 archive 结构与回放能力的实现。
