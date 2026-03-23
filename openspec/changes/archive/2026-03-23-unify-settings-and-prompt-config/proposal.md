## Why

当前 cliV 的设置边界对用户并不清晰：

- 阅读与界面偏好主要保存在前端 `localStorage`
- `trusted_callers`、`ignored_callers`、`scan_depth` 和 prompt header override 保存在 `~/.cliv/config.toml`
- 应用级命令和高频提交命令目前分散并写死在前端逻辑里
- Codex / Claude / Gemini 的 hook 配置又分别保存在各自的配置文件里

这会带来三个问题。第一，用户在 settings 面板里改的内容和 cliV 真正的配置文件不是同一个持久化边界，容易让人误以为“有一套 UI 设置”和“另一套高级配置”。第二，prompt 设置虽然对实际使用很重要，但目前只以 config-file override 的形式存在，不是 settings 里的一级能力。第三，像 `submit_annotation` 和 `submit_return` 这样的高频命令已经是稳定的用户交互契约，却还没有进入同一个设置体系，也没有被明确命名和定义冲突优先级。

这次 change 应该把 settings 从“阅读偏好面板”升级成“cliV 自己的设置系统”：

- cliV 自己的 durable settings 尽量收敛到一个配置文件
- prompt 设置成为 settings 的一等公民
- 应用级命令与被明确支持的高频提交命令进入同一个配置模型
- agent 自己的 hook 配置继续留在各自文件中，不与 cliV 设置混淆

## What Changes

- 定义 cliV 自有 durable settings 的单一持久化边界：`~/.cliv/config.toml`
- 在现有 `[launch]`、`[prompts]` 之外增加面向 settings 的 `[ui]` 配置分组，用于承载 cliV 自己的阅读/界面偏好
- 增加用于快捷命令的 `ui.shortcuts` 配置分组，覆盖受支持的应用级命令以及被明确纳入一期的提交命令
- 将 `submit_annotation` 与 `submit_return` 都纳入一期快捷键支持范围，并定义焦点优先级
- 将 prompt 设置提升为 settings 的一级能力；第一阶段先围绕现有的 `reply/iterate × zh/en` header 配置展开
- 让 settings 面板明确区分：
  - cliV 自己可管理的设置
  - 外部 agent 的集成状态与 hook 配置
- 为现有 `localStorage` 中的受支持 UI 偏好定义兼容与迁移策略，避免升级后用户偏好丢失
- 保留 `launch` 配置在同一个文件中的稳定边界，但不要求第一版就把所有 launch 策略都做成常规 UI 编辑项

## Capabilities

### New Capabilities

- `settings-system`: 定义 cliV 的设置体系、持久化边界、prompt 设置、快捷命令，以及与外部 agent 配置的责任划分

### Modified Capabilities

- None.

## Impact

- Tauri backend config schema、config load/save 路径与原子写入策略
- frontend settings 信息架构、config store、prompt settings 与 shortcut settings 交互
- keyboard shortcut dispatch、焦点优先级与快捷键冲突校验
- prompt header 解析与返回构建链路
- 持久化兼容逻辑，尤其是现有 `localStorage` 偏好的迁移
- README、集成文档与 settings 相关说明
