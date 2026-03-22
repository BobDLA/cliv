## 1. Config Contract And Persistence

- [ ] 1.1 为 `~/.cliv/config.toml` 增加 `ui` 与 `ui.shortcuts` 的稳定 schema，并定义与现有 `launch` / `prompts` 的兼容边界。
- [ ] 1.2 在 Tauri backend 中增加面向 settings 的 config 写回能力，要求使用原子写入并避免清空未知配置内容。
- [ ] 1.3 定义并实现旧 `localStorage` UI 偏好的兼容 / 迁移策略，确保升级后不会静默丢失已有生效设置。
- [ ] 1.4 为 config load/save、prompt header 持久化、快捷键配置解析、焦点优先级、迁移优先级补 Rust automated tests。

## 2. Settings Surface, Prompts, And Shortcuts

- [ ] 2.1 将 settings 信息架构调整为 `Reading`、`Prompts`、`Shortcuts`、`Integrations`，去掉模糊的杂项 `Advanced` 承载方式。
- [ ] 2.2 把 `reply/iterate × zh/en` prompt header 做成可编辑、可恢复默认值的 settings 能力。
- [ ] 2.3 为受支持的快捷命令提供配置 UI，并明确支持 `submit_return` 与 `submit_annotation` 同期进入。
- [ ] 2.4 为相同键位分配给 `submit_return` 与 `submit_annotation` 的情况实现稳定的焦点优先级行为。
- [ ] 2.5 将受支持的 durable UI 偏好切换到 config-backed settings contract；宽度类设置保持兼容，但不作为本次 UX 优先主线。
- [ ] 2.6 在 `Integrations` 中展示 cliV config 状态与外部 agent hook 配置边界，不直接接管 `.codex`、`.claude`、`.gemini` 配置文件。
- [ ] 2.7 为 settings prompt 编辑、快捷键修改、恢复默认值、重启后恢复值以及双 `Mod+Enter` 优先级补 frontend regression tests。

## 3. Docs And Verification

- [ ] 3.1 更新 `README.md`、`README.zh-CN.md`、`docs/integrations.md`、`docs/integrations.zh-CN.md`，明确统一后的 cliV config 模型、快捷键配置边界以及与 agent hook 文件的边界。
- [ ] 3.2 若某些设置迁移、快捷键冲突处理或 prompt 编辑流程暂时无法自动化，更新 `docs/regression-cases.md` 记录具名回归场景与原因。
- [ ] 3.3 运行与记录最小验证集：
  - `pnpm test -- src/app/__tests__/App.test.tsx`
  - `pnpm test -- src/features/annotations/__tests__/annotationFlow.test.tsx`
  - `pnpm test -- src/features/return/__tests__/ReturnBuilder.test.tsx`
  - 与快捷键设置相关的 frontend tests
  - `cargo test --manifest-path src-tauri/Cargo.toml config::tests`
  - 与本次新增 config command 对应的 Rust tests
- [ ] 3.4 记录 `openspec validate` 的结果，以及双 `Mod+Enter` 修改后的关键手动验证场景。
