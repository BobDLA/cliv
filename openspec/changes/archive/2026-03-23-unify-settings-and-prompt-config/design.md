## Context

当前仓库已经存在两条并行的设置路径：

- 前端 `useUIStore` 通过 `cliv:*` `localStorage` key 持久化主题、字号、语言和阅读偏好
- Tauri backend 通过 `~/.cliv/config.toml` 加载 `launch` 与 `prompts` 配置，并通过 `get_app_config` 暴露给前端

除此之外，快捷命令也已经形成了稳定行为，但仍然散落在前端不同位置：

- `useKeyboardShortcuts.ts` 处理打开文件、添加批注、字号控制
- `DocumentSearch.tsx` 处理文内搜索开关
- `ReturnBuilder.tsx` 处理整体 return 提交快捷键
- `AnnotationPopup.tsx` 处理批注提交快捷键

这意味着“cliV 自己的设置”在实现上被拆成了三类：前端 `localStorage` 偏好、后端 `config.toml` 配置、以及硬编码的快捷命令。用户在 settings 面板里看到的是一部分，实际影响启动策略、prompt header 和关键命令行为的又是别的地方。与此同时，prompt 设置虽然直接影响返回内容，但目前既没有独立的信息架构，也没有可写回路径，前端只能读取后端给出的 effective config。

用户这轮反馈已经把优先级重新排清了：

- 宽度类设置不是 settings 升级主线
- prompt 设置是重要能力，不能继续被放在模糊的 advanced bucket 里
- `submit_annotation` 和 `submit_return` 都要进入一期快捷键支持
- 从用户心智上看，cliV 自己的设置最好尽量收敛到一个配置源

## Goals / Non-Goals

**Goals**

- 为 cliV 自己的 durable settings 定义单一、清晰、可解释的持久化边界
- 让 prompt 设置成为 settings 中的一等能力
- 让受支持的快捷命令进入同一个 cliV 设置模型
- 在 settings 中明确区分 cliV 自己的设置与外部 agent 的集成配置
- 为现有 `localStorage` 偏好提供兼容或迁移路径，避免升级丢失用户偏好
- 为 `submit_annotation` 和 `submit_return` 定义稳定的命令名与焦点优先级

**Non-Goals**

- 将 Codex / Claude / Gemini 的 hook 配置合并到 cliV 的配置文件中
- 第一版就实现完整的自由模板系统或 per-agent prompt DSL
- 以宽度类微调项为这次 settings 升级的主导目标
- 将所有临时 UI 状态都迁入 config file
- 放开所有输入框、弹窗或组件内部的局部编辑按键为可配置命令
- 接管外部 agent 侧的 `Ctrl+G` / `$EDITOR` 触发键

## Decisions

### 1. `~/.cliv/config.toml` 成为 cliV 自有 durable settings 的 source of truth

这次 change 之后，cliV 自己的 durable settings 应收敛到同一个配置文件里，而不是继续分裂为 “settings 面板写 localStorage” 与 “高级配置写 config.toml” 与 “快捷命令写死在前端”。

建议目标结构：

```toml
[ui]
theme = "light"
font_size = 18
locale = "zh"
sidebar_open = true
sidebar_tab = "outline"
sidebar_width = 224
annotation_margin_width = 256
content_width = "standard"
page_padding = "comfortable"
reading_density = "comfortable"
highlight_strength = "balanced"

[ui.shortcuts]
open_file = "Mod+O"
search = "Mod+F"
submit_return = "Mod+Enter"
submit_annotation = "Mod+Enter"
add_annotation = "Mod+Alt+M"
font_increase = "Mod+="
font_decrease = "Mod+-"
font_reset = "Mod+0"

[prompts]
reply_header_zh = "..."
reply_header_en = "..."
iterate_header_zh = "..."
iterate_header_en = "..."

[launch]
scan_depth = 5
trusted_callers = ["codex", "claude", "gemini"]
ignored_callers = ["bash", "zsh", "fish", "tmux"]
```

Why:

- 用户对 “cliV 的设置” 的心智模型天然是单一的
- prompt、reading preferences、快捷命令都属于 cliV 自己的产品设置，不应长期分裂到多套持久化机制
- `launch`、`prompts`、`ui` 同处一个文件，既统一又能保留职责分组

Alternative considered:

- 继续保留 `localStorage + config.toml + hardcoded shortcuts` 三轨。Rejected，因为这正是当前 settings 升级想解决的认知分裂。

### 2. settings 面板按 “Reading / Prompts / Shortcuts / Integrations” 组织

现有设置面板已经完成了 reading V1，但如果继续只追加零散控件，会让 prompt 设置继续处于边缘状态，也无法解释配置边界。快捷命令如果纳入设置，也不应该被塞进模糊的 `Advanced`。

新的 settings IA 应至少包含：

- `Reading`: 主题、字号、语言、阅读呈现相关选项
- `Prompts`: reply / iterate prompt header 相关设置
- `Shortcuts`: 受支持命令快捷键
- `Integrations`: 外部 agent hook 配置状态、cliV config 文件状态、边界说明

Why:

- prompt 设置与快捷命令都被提升为一级能力
- 用户能直接理解“哪些是 cliV 自己管的，哪些只是外部集成状态”
- `Integrations` 可以解释为什么 agent hook 仍然留在各自配置文件中

Alternative considered:

- 保持 `appearance / layout / advanced`。Rejected，因为 `advanced` 很容易重新退化为杂项区。

### 3. prompt 设置第一阶段复用现有四个 header 字段，而不冒充完整模板编辑器

当前已稳定存在的 prompt 配置能力其实只有四个字段：

- `reply_header_zh`
- `reply_header_en`
- `iterate_header_zh`
- `iterate_header_en`

这次 change 应把它们做成真正可发现、可编辑、可重置的 settings 能力，但不把第一版表述成完整模板系统。

Why:

- 现有 schema 与 prompt 解析逻辑已经围绕这四个字段工作
- 用户关心的是 prompt 可配置，而不是必须一步到位进入全模板 DSL
- 先把已有稳定字段 UI 化，风险远低于直接重构 prompt 生成模型

Alternative considered:

- 直接引入完整模板编辑器。Rejected，因为当前代码和 spec 都还没有完整模板语义。

### 4. 快捷命令使用显式命令表，不做任意键位系统

第一阶段应以显式支持的命令表为边界，例如：

- `open_file`
- `search`
- `submit_return`
- `submit_annotation`
- `add_annotation`
- `font_increase`
- `font_decrease`
- `font_reset`

配置值应使用跨平台的加速键表达，例如 `Mod+O`、`Mod+Enter`，由运行时映射到 macOS 的 `Command` 与其他平台的 `Control`。

Why:

- 受支持命令是用户能理解和记忆的稳定动作集合
- 显式命令表可以降低冲突处理、文档、测试与支持成本
- 这允许一期明确支持两个提交流，而不必开放整个局部按键系统

Alternative considered:

- 做任意快捷键录制系统。Rejected，因为范围和冲突复杂度过高。

### 5. 同键位冲突通过焦点优先级解决，而不是禁止

`submit_annotation` 与 `submit_return` 都应支持进入一期，即使默认都使用 `Mod+Enter`。系统必须定义稳定优先级：

- 当批注弹窗输入区域处于活动焦点时，`submit_annotation` 优先于 `submit_return`
- 当批注弹窗未处于活动提交上下文时，`submit_return` 可以响应相同键位

Why:

- 当前产品已经同时存在这两个高频提交流
- 用户希望二者都可配置并进入一期
- 用焦点优先级解决冲突，符合用户对“当前正在编辑什么，就提交什么”的直觉

Alternative considered:

- 强制要求二者键位不同。Rejected，因为会破坏当前已有习惯，也没有必要。

### 6. backend 必须拥有 config 写回能力，并负责兼容迁移

目前 backend 只有 `load()` 和 `get_app_config`，没有写回路径。要让 settings 真正统一到 `~/.cliv/config.toml`，必须由 Tauri backend 提供受控写入命令。

写入设计应满足：

- 原子写入，保持现有文件写安全边界
- 仅修改 cliV 自己拥有的已知 section / key
- 尽可能保留未知字段，不应因 UI 写入而清空未来扩展或手工添加内容
- 对现有 `localStorage` 值提供兼容：至少保证升级后不会静默丢失现有效果
- 对无效快捷键值或不受支持命令安全回退到默认值

Why:

- frontend 不能直接承担文件系统和 schema 兼容责任
- config 写入是稳定契约，不应该散落在 UI 层
- 一旦 settings 变成 file-backed，迁移与 merge 行为就属于 backend 责任

Alternative considered:

- 继续只读 config，settings 仍写 localStorage。Rejected，因为无法形成单一设置边界。

### 7. 外部 agent hook 配置继续保留在各自文件中，但 settings 需要显式表达这个边界

即使 cliV 自己的设置统一到 `~/.cliv/config.toml`，下面这些文件仍然是 agent 自己的集成配置：

- `~/.codex/config.toml`
- `~/.claude/settings.json`
- `~/.gemini/settings.json`

settings 不应假装完全接管这些文件，但可以展示状态和说明。

Why:

- 这些文件由各 agent CLI 拥有，不是 cliV 的配置域
- 强行写入外部配置会放大权限、兼容性和错误恢复风险
- 用户仍然需要知道“为什么我在 cliV 里改设置，不会自动改 agent hook”

Alternative considered:

- 让 cliV 接管外部 hook 文件。Rejected，因为跨产品配置所有权不清晰且风险高。

### 8. 宽度类设置继续保留支持，但不作为这次 change 的优先驱动

sidebar / annotation margin width 已经有稳定持久化与 runtime clamp 逻辑。它们可以继续作为已支持 UI 偏好存在，但这次 settings 升级不应围绕它们组织主要产品叙事。

Why:

- 用户明确反馈这不是当前最重要的问题
- prompt 设置、快捷命令与存储边界才是这次真正需要澄清的能力

Alternative considered:

- 继续把“补齐 width controls”当成 settings 升级主线。Rejected，因为价值排序不匹配用户反馈。

## Risks / Trade-offs

- [Config 写回覆盖手工内容] → 需要采用保留未知字段的写入策略，并明确文档化重写边界
- [迁移期 config 与 localStorage 双写不一致] → 明确 `config > localStorage > defaults` 的读取优先级，并限制双写窗口
- [用户期待的是完整模板编辑器] → 在 UI 与文档中明确第一版是 prompt header settings，不承诺完整模板 DSL
- [快捷键冲突导致常用动作不可用] → 通过焦点优先级与显式命令表解决，并提供默认值恢复与冲突校验
- [settings 面板职责继续膨胀] → 以 `Reading / Prompts / Shortcuts / Integrations` 分区约束范围，不重新引入模糊的 `Advanced`
- [外部 hook 配置边界被误解] → 在 `Integrations` 中明确说明哪些配置由 cliV 管，哪些由 agent CLI 自己管

## Migration Plan

- 读取优先级采用 `config file > localStorage compatibility > defaults`
- 新版本首次写入受支持 settings 时，将 effective value 写入 `~/.cliv/config.toml`
- 在兼容期内可保留 `localStorage` 读取能力，但不再把它视为长期 source of truth
- `launch` 与现有 `prompts` 字段保持向后兼容，已有用户配置无需改名即可继续生效
- 快捷命令在没有用户配置时使用内建默认值；遇到无效配置时安全回退到默认值

## Open Questions

- `Prompts` 区域第一版是否需要实时预览生成后的 header，还是只做字段编辑与默认值恢复
- `Shortcuts` 区域第一版是否需要冲突可视化，还是先只做保存前校验与错误提示
- `launch` 相关项是否在第一版 settings 中保持只读说明，还是开放极少量可编辑字段
