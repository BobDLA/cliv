# Testing / Docs Linkage Note

## Background

在这次整理之前，`docs/testing-standard.md`、`docs/regression-cases.md`、自动化测试文件与 CI 之间主要靠人工约定保持一致。

这带来几个常见风险：

- regression case 的 `Evidence` 可能指向已经移动或删除的文件
- `docs/testing-standard.md` 里列出的 CI 覆盖命令，可能和 `.github/workflows/test.yml` / `package.json` 漂移
- `Coverage: manual` / `Coverage: pending` 的 case 容易写得过于抽象，后续维护者看不出怎么验证、为什么没自动化
- 大家知道“应该保持一致”，但仓库里没有一个便宜、稳定、可重复执行的检查点

## Decision

本仓库采用一个**最小联动**方案，而不是重型质量平台。

新增：

- `scripts/validate_testing_docs.py`
- `pnpm test:docs`
- CI 中的 `Testing docs linkage` 步骤

这套检查只做轻量一致性校验：

1. `docs/regression-cases.md` 中 `Coverage: automated` 的 case 必须提供有效 `Evidence:`
2. `Evidence` 必须指向仓库内真实存在的文件
3. 自动化 evidence 必须能映射到当前 CI 覆盖层：
   - `pnpm test`
   - `cargo test --manifest-path src-tauri/Cargo.toml`
   - `pnpm test:e2e`
   - `pnpm test:e2e:desktop`
4. `docs/testing-standard.md` 中声明的 CI 当前覆盖命令，必须和 `.github/workflows/test.yml` / `package.json` 保持一致
5. `Coverage: manual` 的 case 必须写 `Manual verification:`
6. `Coverage: pending` 的 case 必须写 `Reason:`

## Why this level

### 为什么不更复杂

本次不做这些：

- 不做 diff-aware 的“按改动自动推导最低验证要求”
- 不做 PR 描述强制解析和自动打分
- 不把 `/qa` / `/qa-only` 报告直接纳入 CI gate
- 不尝试判断每条测试断言是否“足够强”
- 不做完整 ADR / OpenSpec 流程

原因是这次要解决的核心问题是**漂移**，不是构建一整套复杂的质量治理平台。

如果一开始就做太重，会带来：

- 维护成本高
- 误报多
- 规则过度复杂
- 开发者绕过或忽视这套系统

### 为什么不更简单

本次也不只停留在文档约定。

如果只有文档，没有脚本和 CI 检查，后续很容易再次出现：

- 文档提到的命令与实际 workflow 不一致
- regression case 的 evidence 失效却没人发现
- manual / pending case 写得模糊，无法复用

因此需要一个成本很低但能稳定运行的检查点：`pnpm test:docs`。

## Relationship to /qa and /qa-only

`/qa` 与 `/qa-only` 仍然有价值，但它们不属于这次的硬联动范围。

它们更适合：

- 发现真实问题
- 做探索式验证
- 产出人工验证步骤草稿
- 帮助决定哪些 case 暂时只能是 `manual` 或 `pending`

但它们不适合作为这次 CI linkage 的直接输入，因为 QA 报告通常是会话产物，而不是稳定、长期存在的 repo 内测试资产。

因此本次的边界是：

- `test:docs` 负责校验 **文档 ↔ 测试入口 ↔ CI**
- `/qa` / `/qa-only` 负责提供 **探索式验证与人工验证素材**

## Maintenance Method

### 新增或更新 regression case 时

1. 先确定 `Coverage`：`automated` / `manual` / `pending`
2. 根据覆盖类型补齐字段：
   - `automated` → `Evidence:`
   - `manual` → `Manual verification:`，必要时补 `Reason:`
   - `pending` → `Reason:`
3. 若是自动化 case，确认 evidence 对应的测试入口仍被 CI 覆盖
4. 运行：

```bash
pnpm test:docs
```

### 调整测试命令或 CI 时

如果修改了这些内容：

- `package.json` scripts
- `.github/workflows/test.yml`
- `docs/testing-standard.md` 中的 “CI 当前覆盖” 列表

则应同步跑一次：

```bash
pnpm test:docs
```

确保三者没有漂移。

## Non-goals

这套机制**不**负责：

- 证明某条 case 的断言足够强
- 代替 code review
- 代替真实前端 / Rust / E2E / desktop 自动化测试
- 代替 OpenSpec 的用户行为或契约变更流程

## When to Revisit

如果后续出现以下情况，可以再考虑升级：

- manual / pending case 明显增多，维护负担变大
- PR 经常缺少 `## Validation` 证据，需要自动提醒或阻断
- 需要根据 diff 自动推导最低测试要求
- 需要把 QA 报告更系统地纳入长期回归流程

在这些问题真实出现之前，保持当前这版“最小联动”即可。
