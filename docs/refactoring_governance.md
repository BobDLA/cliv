# 重构治理规范

日期：2026-03-14

> 文档角色：长期参考文档，用于定义本项目进行 refactor 时的范围判断、变更边界、文档更新要求、验证底线与归档规则。本文不替代 `openspec/specs/`，但约束“如何做重构”。

## 1. 目的

本项目已经形成一套明确分工：

- `openspec/specs/` 描述当前可观察行为与稳定契约
- `openspec/changes/` 描述正在进行的行为增量
- `doc/adr/` 描述稳定架构决策
- `doc/*.md` 描述长期参考信息，如架构图、数据流、交互模型、协议说明与迁移说明

重构的目标不是“把代码动一遍”，而是：

1. 提高模块边界清晰度
2. 降低 tool-specific 偶然耦合
3. 提升可测试性、可解释性和后续演进速度
4. 在不必要时不改变现有 control-plane 对外契约

---

## 2. 适用范围

本规范适用于以下工作：

- 模块拆分、合并、重命名
- 领域边界调整
- 状态流、数据流、事件流重排
- store / registry / service / adapter / server 层职责调整
- 持久化模型和内部协议整理
- 前端组件树、路由内数据装配、状态来源整理

本规范不要求把纯文案调整、样式微调或小型 bugfix 统称为“重构”。

---

## 3. 重构分类

### 3.1 Type A: Internal Refactor

满足以下条件时，视为纯内部重构：

- 用户可观察行为不变
- operator 可观察行为不变
- 对外 API contract 不变
- timeline / metadata / activation / summary 的稳定字段不变
- 仅调整内部实现、模块边界、命名、依赖关系或测试结构

处理规则：

- 不要伪装成 spec 变更
- 可以不新建 proposal
- 仍然必须更新受影响的长期参考文档与测试

### 3.2 Type B: Contract-Preserving Structural Change

满足以下条件时，视为保留产品契约的结构性重构：

- `productState / currentTask / recentCompletion / Focus / Seen / timeline` 等产品层主契约保持稳定
- 但上游 adapter、runtime envelope、event store、activation metadata、query path 等发生重要结构调整

处理规则：

- 若跨多个模块且难回滚，应在 active change 中记录 design rationale，或补 ADR
- 必须更新对应架构文档、数据流图、持久化说明
- 必须补回归测试，证明产品层 contract 未退化

### 3.3 Type C: Behavior-Changing Refactor

满足以下任一条件时，不再是纯重构，而是行为变更：

- 用户可见状态、交互、流程发生变化
- operator 的观察、提醒、切回、timeline 语义发生变化
- API request / response shape 改变
- 前端 route、状态映射、动作语义改变
- 持久化 contract 或导出数据语义改变

处理规则：

- 必须进入 `openspec/changes/`
- 必须更新增量 spec，必要时同步 proposal / design / tasks
- 实现完成后再同步回主 `specs/`

---

## 4. 默认原则

所有重构默认遵守以下原则：

### 4.1 Freeze Product Contract First

若本轮目标是基础设施整理，默认冻结以下产品层 contract，不与底层重构绑定修改：

- `productState`
- `currentTask`
- `recentCompletion`
- `Focus / Seen`
- timeline v2 的产品语义

只有当用户明确要求改行为，或现有 contract 已经阻塞主线目标时，才允许突破这条原则。

### 4.2 先收敛边界，再引入新能力

不要一边重构基础层，一边并行塞入新的 agent、状态体系或完整工作台能力。  
优先把现有 control-plane 主线收敛清楚，再做新增能力接入。

### 4.3 单轮重构只解决一层主要问题

一轮重构应明确主焦点，只选一层作为中心：

- adapter foundation
- runtime / reconciliation
- API / query layer
- frontend shell / route state
- event store / timeline persistence

允许联动修改，但不应同时发散成多条独立重构主线。

### 4.4 文档与测试必须跟着结构走

本项目不接受“代码结构已经变了，但图、决策、验证口径还是旧的”这种半完成状态。

---

## 5. 文档更新规则

### 5.1 什么时候更新 `openspec/specs/`

只有在可观察行为或稳定契约变化时更新 `openspec/specs/`。  
纯实现重构不得把内部结构整理写成 spec requirement。

### 5.2 什么时候更新 `doc/adr/`

当重构引入以下变化时，应新增或更新 ADR：

- 新的稳定模块边界
- 长期沿用的 transport / storage / state model 决策
- 明确废弃某条旧架构路线
- 会跨多个 change 复用的核心取舍

### 5.3 什么时候更新 `doc/*.md`

当以下内容发生变化时，必须更新对应长期参考文档：

- 架构分层
- 数据流
- 交互流
- 时序图
- 持久化模型
- wrapper / runtime / adapter 协议
- 前端信息架构或页面间数据装配

如果旧图或旧说明已不再代表当前实现，不应继续保留在现行文档位置。

### 5.4 什么时候归档

以下内容应移入 `doc/archive/`：

- 已被现行 spec / ADR / 新参考文档吸收的阶段性方案
- 不再反映当前实现的 workflow / UI 草图
- 已经失效的迁移计划
- 仅保留历史上下文价值的旧架构稿

归档文档开头应说明它被哪些当前文档吸收。

---

## 6. 重点资产的最低维护要求

### 6.1 架构文档

至少要能回答：

- 当前有哪些核心模块
- 每个模块的职责边界是什么
- 哪些边界是稳定的，哪些仍属过渡

### 6.2 数据流与交互图

至少要能回答：

- 输入信号从哪里来
- 经过哪些 service / store / reconciler
- 以什么形式到达 API 和 UI
- `Seen` / `Focus` / timeline / `attention` 这样的关键动作如何闭环

### 6.3 API 参考

当前项目可继续以 `spec + code` 为主，但当 endpoint、query 参数和 response shape 持续增多时，应补集中 API 参考文档。  
它的职责应是“接口索引与联调参考”，不是替代 spec。

### 6.4 持久化与数据库说明

当 `event_store`、session snapshot、annotation、project metadata、timeline segment 等模型变化时，应维护一份可读的持久化说明。  
至少要描述：

- 主要实体
- 主键或稳定 identity
- 关键索引或查询路径
- 写入时机
- 回放 / 聚合 / timeline 查询依赖关系

---

## 7. 实施要求

### 7.1 改动前必须先判断边界

开始重构前，必须先明确：

- 这轮是 Type A、Type B 还是 Type C
- 本轮冻结哪些 contract
- 本轮允许变化哪些内部结构
- 需要同步更新哪些文档

如果这四点说不清，不应直接进入大范围修改。

### 7.2 优先小步可验证迁移

推荐顺序：

1. 提取类型与边界
2. 引入兼容层
3. 迁移单个调用路径
4. 补 regression tests
5. 删除旧路径
6. 更新图表与说明

不鼓励一次性重写整条主链路后再集中修 bug。

### 7.3 保留回滚路径

涉及运行时协议、事件格式、frontend route 或 activation 行为时，应优先保留以下之一：

- 兼容读取旧格式
- 旧入口仍可运行
- 旧 route / legacy response 仍可短期并存

### 7.4 避免命名漂移

重构不能只做“换词不换结构”。  
若仅重命名而没有改善边界、职责或测试，通常不值得作为独立重构。

---

## 8. 测试与验收底线

每次重构至少满足以下要求：

1. 受影响模块的现有测试继续通过
2. 对关键重构点新增至少一个 regression case
3. 若修改 detection / reconciliation / activation / timeline，必须覆盖对应行为回归
4. 若修改 API contract 或前端装配路径，必须覆盖 route-state 或 response-shape 回归

默认检查命令：

- `pnpm run check`
- `pnpm test`

若本轮涉及前端：

- `pnpm run frontend:check`
- `pnpm run frontend:build`

若因环境限制无法执行，必须在结果中明确说明。

---

## 9. 提交物要求

一次完整重构提交，至少应包含以下几类产物中的对应项：

- 代码调整
- 测试更新
- 文档更新
- 必要的 ADR 或 change artifacts

以下情况视为不完整：

- 只改代码，不补受影响测试
- 结构已变化，但架构图和交互图仍描述旧系统
- 实际改了用户可见行为，却没有更新 spec
- 旧方案已失效，但仍留在现行入口混淆读者

---

## 10. 重构检查清单

开始前：

- 是否已经判断本轮属于 Type A / B / C
- 是否明确冻结的产品层 contract
- 是否明确本轮主焦点层
- 是否列出要更新的 spec / ADR / doc / tests

实施中：

- 是否先迁移边界，再删旧路径
- 是否保留必要兼容层
- 是否避免把新功能混入基础重构
- 是否避免把纯内部变化写成 spec requirement

结束前：

- 是否运行了必要检查与测试
- 是否补了关键 regression case
- 是否更新了受影响的图表、交互模型、持久化说明
- 是否归档了已经失效的旧文档
- 是否在结果说明中写清仍存风险与未覆盖项

---

## 11. 当前项目的特别约束

结合当前仓库定位，重构时默认额外遵守以下约束：

- 不默认把项目扩写为“完整多 agent 工作台”
- 不为了接入新 agent 而重做整套产品语义
- 不把 tool-specific 名称继续上推为全系统真相名
- 不让 `currentTask`、`recentCompletion`、`productState` 的责任再次混杂
- 不让 frontend 包装需求压过 control-plane 主线闭环

---

## 12. 推荐落位

当未来继续出现重构需求时，建议按以下方式落位：

- 行为不变的内部整理：遵守本文，直接实施并更新参考文档
- 跨模块且难回滚的结构调整：在 active change 的 `design.md` 或 `doc/adr/` 记录理由
- 行为变化：进入 `openspec/changes/`

本文的目标不是增加流程负担，而是避免项目在“代码已变、契约未说清、图也过时”的状态下继续演进。
