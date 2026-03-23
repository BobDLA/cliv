# cliV Testing Standard

本文件定义 `cliV` 仓库的测试层级、变更到验证的最低映射，以及提交 / PR 时的验证证据格式。

## 1. 目标

测试标准要回答两个问题：

1. 改了哪一层代码，最低要跑什么？
2. 哪些真实问题已经被纳入回归保护？

本标准不替代 CI，也不替代 OpenSpec；它用于统一本地开发、代码评审和提交前验证口径。

当前仓库还提供一个轻量一致性检查：`pnpm test:docs`。
它用于校验：
- `docs/regression-cases.md` 中 `Coverage: automated` 的 `Evidence` 路径确实存在
- 自动化 evidence 能映射到当前 CI 覆盖层（Vitest / Rust / Playwright / desktop）
- 本文档列出的 CI 当前覆盖命令，和 `.github/workflows/test.yml` / `package.json` 脚本保持一致

注意：它不会证明某条 case 的断言强度“足够”，只负责防止文档、测试入口和 CI 配置明显漂移。

实现背景、边界和维护方法见：`docs/testing-doc-linkage.md`。

## 2. 测试层级

### L0 — 静态与快速校验

适用：大多数变更的最小快速门槛。

常用命令：

```bash
pnpm lint
pnpm typecheck
pnpm test -- <targeted test files>
```

### L1 — 前端单元 / 组件回归

适用：React 组件、store、service、prompt 组装、write-back 行为等。

常用命令：

```bash
pnpm test
pnpm test -- src/app/__tests__/App.test.tsx
pnpm test -- src/features/annotations/__tests__/annotationFlow.test.tsx
pnpm test -- src/services/__tests__/promptBuilder.test.ts
pnpm test -- src/services/__tests__/writeBack.test.ts
```

### L2 — Rust 逻辑回归

适用：CLI 参数解析、启动语义、配置加载、Tauri 后端命令与文件处理。

常用命令：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml cli::tests
cargo test --manifest-path src-tauri/Cargo.toml config::tests
```

### L3 — 浏览器 / 交互 E2E

适用：关键交互流程、页面级行为、跨组件联动。

常用命令：

```bash
pnpm test:e2e
```

### L4 — 桌面 / 打包 / 发布验证

适用：Tauri 桌面场景、桌面 smoke、发布产物。

常用命令：

```bash
pnpm test:e2e:desktop
pnpm tauri:build
pnpm tauri:build:release -- --bundles deb
pnpm tauri:build:install-deb
```

说明：只有在涉及桌面行为、打包或发布链路时，才要求 L4。

## 3. 变更类型 → 最低验证要求

### 前端 UI / 交互

涉及目录：
- `src/app/**`
- `src/features/**`
- `src/styles/**`

最低要求：
- 跑相关的 `vitest` 定向测试
- 如果修的是交互 bug，补自动化回归测试
- 如果是纯视觉细节且暂不适合自动化，记录人工验证点

推荐加跑：
- `pnpm typecheck`

### Service / Store / Prompt / Write-back

涉及目录：
- `src/services/**`
- `src/stores/**`
- `src/lib/promptTemplates.ts`

最低要求：
- 跑对应 service / store 测试
- 若行为跨前后端边界，补一条联动验证说明

### Rust CLI / Config / Launch Semantics

涉及目录：
- `src-tauri/src/cli.rs`
- `src-tauri/src/config.rs`
- `src-tauri/src/commands/**`

最低要求：

```bash
cargo test --manifest-path src-tauri/Cargo.toml cli::tests
cargo test --manifest-path src-tauri/Cargo.toml config::tests
```

如果改动范围更大，再跑：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### 文档 / 集成说明

涉及目录：
- `README.md`
- `README.zh-CN.md`
- `docs/install-guide*.md`
- `docs/integrations*.md`

最低要求：
- 示例命令、参数、路径、配置与当前实现一致
- 行为变更时，同步对应中英文文档

### OpenSpec 变更

涉及目录：
- `openspec/changes/**`

最低要求：
1. `verify`
2. `sync`
3. `archive`

建议顺序：
- 实现完成后先 verify
- 需要落正式 spec 时再 sync
- 最后 archive，并与代码一起进入最终提交

## 4. Bug Fix 要求

每个 bug fix 至少满足以下二选一：

1. 自动化回归测试
2. 命名明确的人工回归用例，并说明为什么暂时无法自动化

默认优先自动化。对于可稳定复现的逻辑/组件问题，不应只做人工验证。

## 5. 验证证据格式

提交说明、PR 描述、review 回复建议使用统一格式：

```md
## Validation

### Ran
- pnpm test -- src/features/annotations/__tests__/annotationFlow.test.tsx
- cargo test --manifest-path src-tauri/Cargo.toml cli::tests

### Not run
- pnpm test:e2e
  - reason: 本次只修改 CLI/config 解析，不影响浏览器交互路径
```

要求：
- 跑了的写清命令
- 没跑的也显式写清原因
- 不用用“省略”代替说明

## 6. 与 CI 的关系

CI 当前覆盖：
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm test:e2e`
- `pnpm test:e2e:desktop`

参考文件：
- `.github/workflows/test.yml`

本地开发不要求每次都跑满 CI 全量，但提交前至少要满足本标准中的最低验证要求。

## 7. 推荐实践

- 小改动优先跑定向测试，不要一上来跑全套
- 改公共行为或边界契约时，再升级到更高层级验证
- 修真实用户问题时，把问题沉淀到 `docs/regression-cases.md`
- 改 OpenSpec 行为时，同步检查 `README` / `docs` / demo 文案是否漂移
