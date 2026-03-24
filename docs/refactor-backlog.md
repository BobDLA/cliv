# cliV Refactor Backlog

日期：2026-03-23

> 角色：全仓重构执行清单。用于把本仓库已识别的坏味道收敛成可单独落地、可单独验证、可单独回滚的切片。
>
> 约束来源：`AGENTS.md`、`docs/refactoring_governance.md`、`docs/testing-standard.md`、`docs/regression-cases.md`

## 全局冻结契约

除非某个条目标记为需要进入 `openspec/changes/`，以下产品层 contract 在本轮 backlog 中默认冻结：

- `productState`
- `currentTask`
- `recentCompletion`
- `Focus / Seen`
- timeline v2 产品语义
- 现有 Tauri command 名称、CLI flags、前端主 route 语义

---

## Backlog

| Order | Status | Item | Type | Focus | Why now | Scope | Validation floor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | done | Extractor shared flow cleanup | Type A | adapter foundation | `src-tauri/src/extract/*.rs` 里存在重复的 fallback / transcript / cache 骨架，三套实现边界不一致，后续加 agent 容易继续复制 | `src-tauri/src/extract/mod.rs`, `src-tauri/src/extract/common.rs`, `src-tauri/src/extract/claude.rs`, `src-tauri/src/extract/gemini.rs`, `src-tauri/src/extract/codex.rs` | `cargo test --manifest-path src-tauri/Cargo.toml extract::`; `cargo test --manifest-path src-tauri/Cargo.toml --test anti_crosstalk` |
| 2 | done | Return builder decomposition | Type A | frontend shell / route state | `ReturnBuilder.tsx` 接近 1000 行，混合 prompt seed、拖拽布局、提交锁、归档写入、键盘 shortcut 与渲染；维护成本高，测试定位也被稀释 | `src/features/return/ReturnBuilder.tsx`, 新增 `src/features/return/*` 辅助模块，必要时补 `src/features/return/__tests__/*` | `pnpm test -- src/features/return/__tests__/ReturnBuilder.test.tsx`; `pnpm typecheck` |
| 3 | done | Document init orchestration split | Type A | frontend shell / route state | `useInitDocument.ts` 同时负责 config hydrate、CLI args 读取、reply fallback、demo init、open-file 流程；启动路径耦合过重 | `src/app/hooks/useInitDocument.ts`, `src/app/__tests__/useInitDocument*.test.tsx`, 可能新增 `src/app/hooks/useInitDocument*.ts` | `pnpm test -- src/app/__tests__/useInitDocument.test.tsx src/app/__tests__/useInitDocument.tauri.test.tsx`; `pnpm typecheck` |
| 4 | done | Personalization panel split | Type A | frontend shell / route state | `PersonalizationPanel.tsx` 混合 tab 结构、draft state、reset/save 流程和细节 UI，导致配置演进必须改大文件 | `src/app/components/PersonalizationPanel.tsx`, 新增面板子组件 / hooks，`src/app/components/__tests__/PersonalizationPanel.test.tsx` | `pnpm test -- src/app/components/__tests__/PersonalizationPanel.test.tsx`; `pnpm typecheck` |
| 5 | done | History archive command layering | Type B | event store / timeline persistence | `src-tauri/src/commands/history.rs` 把目录布局、原子写入、workspace key、索引搜索、DTO 和命令入口揉在一起；后续归档能力扩展会继续放大命令文件 | `src-tauri/src/commands/history.rs` 拆分为 storage / index / dto / command glue；必要时同步 `src/services/historyService.ts`, `src/stores/historyStore.ts` | `cargo test --manifest-path src-tauri/Cargo.toml history`; 若前端联动变更，补相关 `pnpm test -- src/features/history/__tests__/HistoryTree.test.tsx` |
| 6 | done | Config model layering | Type B | persistence / config model | `src-tauri/src/config.rs` 集中 schema、default、merge、normalization、trusted caller 逻辑；再叠加新配置会持续恶化边界 | `src-tauri/src/config.rs` 及其测试；必要时补长期文档说明 config model 边界 | `cargo test --manifest-path src-tauri/Cargo.toml config::tests`; 视影响面决定是否补 `cargo test --manifest-path src-tauri/Cargo.toml` |
| 7 | done | Session-history boundary cleanup | Type B | persistence / session model | `sessionService` 与 archive-backed history 仍然双轨存在，但“restore review snapshot” 编排已收敛到共享边界，避免 session/history 各自散落直写多个 store | `src/services/sessionService.ts`, `src/stores/sessionStore.ts`, `src/features/history/**`, `src/features/sessions/**`, `docs/session-history-boundary.md` | `pnpm test -- src/services/__tests__/sessionService.test.ts src/features/history/__tests__/HistoryTree.test.tsx src/features/sessions/__tests__/SessionTree.test.tsx`; `pnpm typecheck` |

---

## 已完成项

### 1. Extractor shared flow cleanup

- **Type:** Type A
- **Frozen contract:** reply extractor 查找优先级、Tauri command 名称、错误语义不变
- **Changed:** 提取共享 extractor 骨架，收敛 Codex / Claude / Gemini 重复流程
- **Validation:**
  - `cargo test --manifest-path src-tauri/Cargo.toml extract::`
  - `cargo test --manifest-path src-tauri/Cargo.toml --test anti_crosstalk`

### 2. Return builder decomposition

- **Type:** Type A
- **Frozen contract:** prompt seed 规则、批注聚合格式、提交锁语义、归档写入触发条件、快捷键行为、现有 `data-testid` 不变
- **Changed:** 将 `ReturnBuilder` 拆为装配层、纯工具模块、布局 hook、编辑器状态 hook、提交流程 hook 与展示分区组件
- **Validation:**
  - `pnpm test -- src/features/return/__tests__/ReturnBuilder.test.tsx src/features/return/__tests__/returnBuilderUtils.test.ts`
  - `pnpm typecheck`

### 3. Document init orchestration split

- **Type:** Type A
- **Frozen contract:** direct launch 空白策略、trusted/agent launch reply fallback、demo locale 切换重载、Tauri remount 重新 hydrate config、open-file fallback 行为不变
- **Changed:** 将 `useInitDocument` 缩成时机协调层，拆出 reply recovery、document state 组装、demo document 组装和 open-file document 组装 helper
- **Validation:**
  - `pnpm test -- src/app/__tests__/useInitDocument.test.tsx src/app/__tests__/useInitDocument.tauri.test.tsx src/app/hooks/useInitDocument.test.ts`
  - `pnpm typecheck`

### 4. Personalization panel split

- **Type:** Type A
- **Frozen contract:** settings tab 切换、prompt draft blur-save、shortcut normalize/save、integration copy、现有 `data-testid` 与用户文案不变
- **Changed:** 将 `PersonalizationPanel` 拆为面板壳、配置元数据模块、通用 UI 原语模块和各 tab 内容模块
- **Validation:**
  - `pnpm test -- src/app/components/__tests__/PersonalizationPanel.test.tsx`
  - `pnpm typecheck`

### 5. History archive command layering

- **Type:** Type B
- **Frozen contract:** Tauri history command 名称、返回 DTO、归档目录布局、search text 语义、只读回放行为不变
- **Changed:** 将 `history.rs` 拆为命令壳、model、paths、storage、service 五层，保留原命令入口和数据 shape
- **Validation:**
  - `cargo test --manifest-path src-tauri/Cargo.toml history`

### 6. Config model layering

- **Type:** Type B
- **Frozen contract:** config.toml shape、默认 trusted caller / shortcut、解析归一化规则、保存 merge 语义、并发保存行为不变
- **Changed:** 将 `config.rs` 拆为根类型层、defaults、normalize、TOML merge/store、IO 五层，保留原公开 API 与测试断言
- **Validation:**
  - `cargo test --manifest-path src-tauri/Cargo.toml config::tests`

### 7. Session-history boundary cleanup

- **Type:** Type B
- **Frozen contract:** saved session 继续以可编辑文档打开；archive replay 继续以只读场景打开；`localStorage` session 数据保持可读；session/history sidebar 行为与现有 route 语义不变
- **Changed:** 提取共享 `reviewSnapshot` restore seam，统一 session/history 的 document + annotation 恢复编排；将 `sessionService` 拆为 storage / repository / summary helper；补充 `docs/session-history-boundary.md` 说明双轨持久化边界
- **Validation:**
  - `pnpm install --frozen-lockfile`
  - `pnpm test -- src/services/__tests__/sessionService.test.ts src/features/history/__tests__/HistoryTree.test.tsx src/features/sessions/__tests__/SessionTree.test.tsx`
  - `pnpm typecheck`

---

## 执行顺序说明

1. 先清理前端超大组件和启动装配的 Type A 切片，降低局部复杂度。
2. 再进入 history / config 这类 Type B 结构重排，避免在 UI 未收敛前同时推动多层迁移。
3. `Session-history boundary cleanup` 已重新判定为 Type B，并在不改产品语义的前提下完成 shared restore seam 与 session persistence layering。
