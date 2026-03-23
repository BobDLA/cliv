# cliV Regression Cases

本文件记录 `cliV` 已知关键回归场景。

目标不是替代自动化测试文件，而是回答：

- 哪些真实问题已经被纳入回归保护？
- 当前是自动化覆盖、人工 smoke，还是待补？
- 对应证据在哪里？

## 状态说明

- `automated`：已有自动化测试覆盖
- `manual`：有明确人工验证步骤，但暂未自动化
  - 必须写 `Manual verification:`
  - 如果当前还不适合自动化，再补 `Reason:`
- `pending`：已识别风险，但还未形成稳定保护
  - 必须写 `Reason:`

---

## Annotation Flow

### ANN-001 — 选中文本后立即打开 create popup 并聚焦输入框
- **Area:** annotations
- **Scenario:** 用户完成有效文本选择后，create popup 立即打开，textarea 自动聚焦
- **Expected:** 不需要二次点击即可直接输入
- **Coverage:** automated
- **Evidence:** `src/features/annotations/__tests__/annotationFlow.test.tsx`

### ANN-002 — popup 打开后，重新选择 / 复制别处内容不应替换当前 draft
- **Area:** annotations
- **Scenario:** create popup 已打开，用户去选择或复制其他文字
- **Expected:** 当前 selection、draft、kind 保持不变，直到显式 submit 或 close
- **Coverage:** automated
- **Evidence:** `src/features/annotations/__tests__/annotationFlow.test.tsx`

### ANN-003 — focus 导致原生 selection collapse 时，不应丢失 create context
- **Area:** annotations
- **Scenario:** textarea 自动聚焦后，浏览器原生选区塌缩
- **Expected:** popup 继续保留，stored selection 不丢失
- **Coverage:** automated
- **Evidence:** `src/features/annotations/__tests__/annotationFlow.test.tsx`

### ANN-004 — create-mode 临时高亮在 submit / Escape 后正确清理
- **Area:** annotations
- **Scenario:** create-mode highlight 已出现，用户提交或关闭 popup
- **Expected:** `annotation-creating` 高亮清理；submit 后保存高亮继续走原路径
- **Coverage:** automated
- **Evidence:** `src/features/annotations/__tests__/annotationFlow.test.tsx`

### ANN-005 — create popup 外部点击不应隐式关闭
- **Area:** annotations
- **Scenario:** create popup 打开时点击外部区域
- **Expected:** create draft 继续保留，不隐式 close
- **Coverage:** automated
- **Evidence:** `src/features/annotations/__tests__/annotationFlow.test.tsx`

---

## Launch Context / Target Detection

### LCTX-001 — standalone 单路径启动默认 review-only
- **Area:** launch-context
- **Scenario:** `cliv notes.md`，无 trusted caller 命中，无显式 target flag
- **Expected:** `notes.md` 作为 review 文档，不开启直接写回
- **Coverage:** automated
- **Evidence:** `src-tauri/src/cli.rs`

### LCTX-002 — 显式 target flag 优先于 positional path 解释
- **Area:** launch-context
- **Scenario:** `cliv --target draft.md source.md` 或 `cliv --compose draft.md`
- **Expected:** 显式 target 成为写回目标，review 与 target 分离
- **Coverage:** automated
- **Evidence:** `src-tauri/src/cli.rs`

### LCTX-003 — trusted caller 必须 canonical exact match
- **Area:** launch-context
- **Scenario:** 调用方名称只包含 trusted name 子串，但不是精确 canonical 名称
- **Expected:** 不应被视为 trusted caller
- **Coverage:** automated
- **Evidence:** `src-tauri/src/cli.rs`, `src-tauri/src/config.rs`

### LCTX-004 — wrapper 跳过后，只看第一个 non-wrapper caller
- **Area:** launch-context
- **Scenario:** 父进程链中前面是 wrapper，后面才出现真实调用方
- **Expected:** 跳过 wrapper，只依据第一个 non-wrapper caller 做 trusted 决策
- **Coverage:** automated
- **Evidence:** `src-tauri/src/cli.rs`

### LCTX-005 — review-only 模式写回走 clipboard fallback
- **Area:** write-back
- **Scenario:** 当前 session 没有 write target
- **Expected:** 写回输出走 clipboard，不覆盖 review 文件
- **Coverage:** automated
- **Evidence:** `src/services/__tests__/writeBack.test.ts`

---

## Config / Prompt Behavior

### CFG-001 — 用户配置可扩展 trusted callers
- **Area:** config
- **Scenario:** `~/.cliv/config.toml` 增加 trusted caller
- **Expected:** launch-context 解析能识别该 caller
- **Coverage:** automated
- **Evidence:** `src-tauri/src/config.rs`

### CFG-002 — prompt header override 生效
- **Area:** prompt
- **Scenario:** 配置里自定义 reply / iterate prompt header
- **Expected:** prompt 生成使用配置值而不是内置默认值
- **Coverage:** automated
- **Evidence:** `src/services/__tests__/promptBuilder.test.ts`

---

## Worktree Tooling

### WT-001 — shared-cache helper 不得让默认 Rust 安装失效
- **Area:** worktree-tooling
- **Scenario:** 已有默认 `~/.cargo` / `~/.rustup` 安装的机器运行 `scripts/setup_shared_worktree_cache.sh <shared-root>` 并 `source` 生成的 env 脚本
- **Expected:** `cargo --version` 仍可正常运行；helper 不会把 `CARGO_HOME` / `RUSTUP_HOME` 改到新的空目录
- **Coverage:** manual
- **Manual verification:** 运行 helper，`source` 生成的 env 文件，再执行 `cargo --version`；确认命令成功且 shell 中未新增 `CARGO_HOME` / `RUSTUP_HOME`
- **Reason:** 当前仓库还没有 shell 脚本测试 harness，这类环境变量副作用更适合先用命名 manual regression 约束

---

## 维护规则

新增真实 bug 或关键用户反馈时：

1. 新增一个 case id
2. 记录场景与期望行为
3. 标记覆盖状态：`automated` / `manual` / `pending`
4. 补对应测试或人工验证说明
5. 在适合时把 `manual` / `pending` 升级成 `automated`

### 文档与自动化的最小绑定规则

- `Coverage: automated` 的 case 必须填写 `Evidence:`，且路径必须指向仓库内现有文件
- `Coverage: manual` 的 case 必须填写 `Manual verification:`；若当前还不适合自动化，再补 `Reason:`
- `Coverage: pending` 的 case 必须填写 `Reason:`
- 若 `Evidence` 指向前端测试文件（如 `*.test.ts[x]`），它应由 `pnpm test` 覆盖
- 若 `Evidence` 指向 Rust 源文件中的 `#[test]`，它应由 `cargo test --manifest-path src-tauri/Cargo.toml` 覆盖
- 若以后引入 Playwright / desktop 专属 case，`Evidence` 应指向对应的 E2E 用例文件，并能映射到 `pnpm test:e2e` 或 `pnpm test:e2e:desktop`
- 可运行 `pnpm test:docs` 做轻量校验，防止 case 文档、测试入口和 CI 覆盖范围漂移
- 方法说明、边界和取舍见：`docs/testing-doc-linkage.md`
