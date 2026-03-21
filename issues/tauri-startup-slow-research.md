# Tauri 启动慢与白屏调研报告

日期：2026-03-19

关联输入：
- `docs/doc/issue_tauri_startup_slow.md`
- `issues/gnome-window-activation.md`

归档说明（2026-03-20）：
- 本文保留了 `daemon-hot-restart` 相关实验的分析上下文
- 文中出现的 idle window / daemon 恢复策略属于已归档实验，不代表当前主线代码状态

调研目标：
- 判断 `cliV` 冷启动时 `2s+` 延迟到底慢在哪一段
- 回答“打开一直是白屏，为什么”
- 评估是否有办法把体验做成“接近瞬时启动”
- 区分“真正性能问题”和“GNOME 窗口激活限制”

## TL;DR

结论不是“Rust/Tauri 本身很慢”，但“白屏”也不能再只归因为首屏性能：

1. Rust/Tauri 进程启动到 `setup()` 只需要大约 `0.3s ~ 0.5s`
2. 冷启动性能问题仍然真实存在，长时间停留主要在 **WebView 冷启动 + 前端 JS/CSS 主包解析执行 + React 首屏初始化**
3. 但这次用户实际遇到的“启动后一直白屏”已确认**不只是首帧太慢**，而是另有一个单文件加载 bug：独立 `.md/.markdown/.txt` 文件在无 metadata 时被读进了 `compose`，却没有进入 `reply`；在当时的实验分支里，前端因此停在 idle / welcome 态
4. 当前本地样本里大量启动来自 `target/debug/cliv`，并且前端启用了 `React.StrictMode`，这会放大开发态首屏耗时，不能直接当 release 体验
5. 因此后续要分两条线处理：
   - 修正错误加载路径，避免“伪白屏”
   - 用 release binary 做基准，继续优化真正的冷启动首屏
   - 把首屏 UI 和重型 Markdown 渲染解耦
   - 必要时上 splash / skeleton，掩盖 WebView 冷启动

## 一、代码路径与本地证据

### 1. Rust/Tauri 启动路径本身不重

`src-tauri/src/lib.rs` 中 `run_gui()` 的 builder 和插件注册都很轻：

- `tauri::Builder::default()`
- `plugin-opener`
- `plugin-dialog`
- `plugin-process`
- `plugin-window-state`
- `setup_tray()`
- `setup_smart_close()`

这些步骤在代码上没有明显重 I/O 或大计算：

- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`

本地日志也支持这一点。一次冷启动样本：

- `run_gui: start` at `+0ms`
- `run_gui: setup start` at `+306ms`
- `run_gui: setup done` at `+310ms`

说明：
- 从进程开始到 Tauri `setup()` 只用了约 `310ms`
- 这远小于用户感知的 `2s ~ 4s`

日志文件：
- `~/.cliv/cliv.log`

### 2. 真正晚的是前端首次“干活”的时间点

同一份日志里，前端首次触发 reply extraction 出现在：

- `extract_claude_reply: start` at `+3559ms`

另一个样本里是：

- `extract_claude_reply: start` at `+4159ms`

这说明：

- Tauri / WebView 外壳已经起来了
- 但前端 JS 到能跑 `useInitDocument()` 并发出第一批 IPC 调用，中间还有大约 `3.2s ~ 3.8s`

这段时间才是用户看到“白屏/没内容”的主要来源。

### 3. 为什么是白屏，而不是你代码里的 loading spinner？

从 React 代码看，应用挂载后本来应该显示 loading UI：

- `src/app/App.tsx`：`isLoading` 为真时显示带旋转图标的加载态
- `src/app/hooks/useInitDocument.ts`：进入 `loadDocument()` 时立即 `setLoading(true)`

但这套 loading UI 的前提是：

- React 已经执行
- 主包 JS 已经下载/解析/执行
- 样式已经生效

如果用户看到的是“纯白 WebView”，说明更早的阶段卡住了：

- WebView 已经显示
- 但 React 应用还没真正 paint 第一帧

所以，这里解释的是**一类真正的冷启动 blank paint**，更像是：

- WebKitGTK 冷启动
- Vite 打出来的前端主包过重
- React 首次初始化太晚

### 4. 但本轮用户遇到的“白屏”并不等于首帧太慢

这次在真实手工验收里复现到的“启动后一直白屏”，后来确认是另一类问题：

- 启动命令是 `cliv /tmp/test.md`
- 该路径没有 metadata
- `load_files()` 会把文件内容读到 `compose`
- 但此前不会把它同时视为 `reply`
- 前端 `App` 依赖 `replyContent` 决定是否展示文档；在当时的实验分支里，`replyContent` 为空时会落回 idle / welcome 视图

结果就是：

- WebView 和 React 其实已经起来了
- 只是当前状态机里没有可展示的 reply
- 用户体感上看起来像“白屏”或“没打开”

这个问题已经在 `src-tauri/src/commands/files.rs` 修复：

- 当没有 metadata，且目标文件是 `.md` / `.markdown` / `.txt`
- 直接把该文件当作待审阅的 `reply`

同时补了两个 Rust 测试：

- `standalone_markdown_file_is_loaded_as_reply`
- `metadata_mode_does_not_fallback_to_compose_as_reply`

因此，旧版本报告里“白屏主要发生在 React 首帧之前”这个判断现在必须收紧为：

- 它仍然解释**冷启动 blank paint**
- 但不能再解释所有“看起来像白屏”的现象

## 二、为什么当前前端首屏偏重

### 1. 主包体积已经偏大

本地构建产物里主包大小为：

- `dist/assets/index-eQvN2G9m.js`: `1,777,469` bytes
- `dist/assets/index-DJbkZwfl.css`: `58,214` bytes

对桌面应用来说这不是“灾难级”，但对“希望窗口一打开就立刻不是白的”这个目标来说，已经足够明显。

### 2. 重型 Markdown 栈在首屏同步路径里

`MarkdownViewer` 顶层直接引入：

- `@uiw/react-markdown-preview`
- `MermaidBlock`

而 `MermaidBlock` 顶层又直接引入：

- `mermaid`

相关文件：
- `src/features/documents/MarkdownViewer.tsx`
- `src/features/documents/MermaidBlock.tsx`

这意味着即使当前文档里根本没有 Mermaid 图，相关依赖也会参与首屏包图和初始化路径。

### 3. 主包里已经能看到 Markdown 生态的大量内容

对编译后的主包做本地检查时，能看到这些关键字：

- `mermaid`
- `katex`
- `remark`
- `rehype`

这说明 Markdown 预览的整套生态链有相当一部分进了首屏主包。

### 4. 当前库本身就提供减包路径

`@uiw/react-markdown-preview` 官方 README 明确提到：

- 可以改用 `@uiw/react-markdown-preview/nohighlight`
- 这样可以排除 `rehype-prism-plus` 相关代码高亮逻辑，减小 bundle

本地文档位置：
- `node_modules/@uiw/react-markdown-preview/README.md`

这不是最终方案，但它证明当前依赖链还有明确可砍的部分。

## 三、为什么日志里 extractor 会重复跑两次

`src/main.tsx` 目前包了：

```tsx
<React.StrictMode>
  <App />
</React.StrictMode>
```

而 `useInitDocument()` 在 `useEffect()` 里直接调用 `loadDocument()`。

这会导致开发态下 effect 双跑，日志里也确实出现了：

- `extract_claude_reply` 连续两次
- `extract_gemini_reply` 连续两次
- `extract_codex_reply` 连续两次

因此：

- 如果当前观测主要来自 `target/debug/cliv`
- 或者来自 dev 风格的前端启动路径

那它比最终 release 体验更差是正常的。

## 四、两类“白屏”要分开

### 1. 冷启动 blank paint

综合代码和日志，真正的冷启动白屏可拆成下面这条链：

```text
进程启动
  -> Rust CLI 解析（极快）
  -> Tauri Builder / 插件注册（极快）
  -> WebKitGTK / WebView 冷启动（中等）
  -> 前端主包加载、解析、执行（重）
  -> React 挂载
  -> useInitDocument() 执行
  -> IPC 读取文件 / reply / metadata
  -> Markdown 大组件首次渲染
  -> 用户终于看到内容
```

这一类里，用户看到的是：

```text
WebView 已经出来
但 React 还没完成第一帧渲染
```

不是：

- Rust CLI 卡住
- `load_files()` 太慢
- 某个 extractor 单次耗时太久

因为日志显示 extractor 开始时已经是 `+3.0s ~ +4.1s` 了，慢发生在它们之前。

### 2. 应用级空态伪装成白屏

本轮实际还确认了另一类“伪白屏”：

```text
进程启动正常
  -> React 已挂载
  -> load_files() 返回 compose 但没有 reply
  -> store 里 replyContent 为空
  -> App 落回 idle / welcome 态
  -> 用户以为是白屏
```

这不是启动性能问题，而是加载路径/状态机问题。

### 3. 本轮实际复现属于哪一类

这次用户报告“启动后一直是白屏”，对应的根因已经核实为第 2 类，也就是：

- 单文件模式下的 `reply` 回填缺失
- 不是单纯的 WebView 冷启动太久

但第 1 类问题仍然存在，所以不能走到另一个极端，误判成“性能完全没问题”。

## 五、daemon 方案能解决什么，不能解决什么

### 1. daemon 能解决“冷启动成本重复支付”

如果 daemon 真能常驻并稳定恢复窗口，那么：

- WebView 只冷启动一次
- 后续每次 `Ctrl+G` 只需要 client 发 IPC
- 这本来是正确方向

### 2. 但 GNOME 下窗口激活是另一类问题

已有文档 `issues/gnome-window-activation.md` 已经说明：

- `show() + set_focus()` 在 GNOME 下不可靠
- 这一轮实测里 `activation_token=false`
- 即使日志出现 `xdotool windowactivate succeeded`，用户仍然可能没有看到窗口到前台

因此：

- “daemon 不能稳定激活窗口”
- 和“冷启动白屏/慢”

是两个问题，不能混为一谈。

### 3. 实际上现在有两个独立目标

目标 A：直接启动时，不要白屏太久  
目标 B：daemon 热启动时，窗口要可恢复

前者主要是首屏性能问题。  
后者主要是 GNOME 窗口管理策略问题。

## 六、上游资料结论

### 1. Tauri 官方对 splashscreen 的态度

Tauri v2 官方文档提供了：

- 主窗口 `visible: false`
- 先显示 splashscreen
- 前后端初始化完成后再显示主窗口

官方文档同时明确表示：

- splashscreen 更像是“慢初始化的 workaround”
- 不是根治启动慢的最佳实践

这和本项目现状完全一致：

- 如果你现在追求“体感瞬开”
- splash/skeleton 是合理的 UX 方案
- 但根治仍然要靠首屏减重

参考：
- https://v2.tauri.app/learn/splashscreen/

### 2. Linux 上 Tauri 用的是系统 WebKitGTK

Tauri 官方文档说明：

- Linux 使用系统 `webkit2gtk`

这意味着：

- Linux 冷启动体验会明显受系统 WebKitGTK 初始化影响
- 这部分不是通过改几行 React 能完全消掉的

参考：
- https://v2.tauri.app/reference/webview-versions/

### 3. GNOME 窗口激活限制不是 cliV 独有问题

上游 issue：

- `tauri-apps/tauri#6310`：Ubuntu GNOME 聚焦问题
- `tauri-apps/tauri#5974`：Linux `unminimize()` 问题

截至本次调研日期：

- `#6310` 仍是 open
- `#5974` 已 closed as not planned

这说明：

- daemon 恢复窗口在 GNOME 下确实有框架外限制
- 不应把这条线当作“短时间内一定能彻底修好”的路径

### 4. 为什么 Chrome 体感明显更快

用户直觉上会问：

- 为什么 Chrome 打开就很快
- 为什么 Tauri + WebView 会显得慢

这两者底层路径并不一样。

对 Tauri 来说：

- Windows 走 `WebView2`
- macOS 走 `WKWebView`
- Linux 走系统 `webkit2gtk`

对 Chrome 来说：

- 它本身就是浏览器
- 有长期驻留、进程复用、预热、缓存和更成熟的启动路径

因此不能把：

- “点击 Chrome 图标后很快看到窗口”

直接类比为：

- “每次启动一个新的 Tauri + WebKitGTK 应用也应该一样快”

Chrome 官方文档里甚至直接提供了 `warmup()` 一类能力，目的就是：

- 先把浏览器进程在后台启动
- 让后续打开页面时少付一次冷启动成本

这和 `cliV daemon` 想做的事情在原理上是一样的：

- 不是把冷启动变没
- 而是提前付掉，或者只付一次

所以：

- Chrome 快，很大一部分来自“热路径”
- 当前 `cliV` 慢，主要是每次都在走“冷路径”

### 5. 跨平台启动体感的合理预期

从底层实现看，合理预期通常是：

```text
Windows >= macOS > Linux
```

解释如下：

- **Windows**：通常会更快，因为 Tauri 使用的是 `WebView2`，它基于 Edge / Chromium 的共享运行时
- **macOS**：通常比 Linux 更稳定，因为 `WKWebView` 是系统核心 WebView 组件
- **Linux**：更容易暴露冷启动问题，因为依赖系统 `webkit2gtk`

但这只是底层 WebView 层面的预期，不代表把同一个前端直接搬到 Windows/macOS 就一定“秒开”。

如果前端首屏仍然是：

- 大主包
- 首屏同步 Markdown 渲染
- Mermaid 同步引入
- 初始 React 工作量过大

那三端都会被拖慢，只是 Linux 更容易最先爆出来。

### 6. WebKitGTK 底层可调空间其实不大

本次检索里没有发现那种“打开一个底层性能开关就能显著提速”的官方路径。

相反，WebKitGTK 不少看起来像性能调优接口的能力，要么：

- 已经废弃
- 要么官方文档明确说明现在几乎不起作用

这意味着：

- 不应把希望寄托在“再挖一个 GTK/WebKit 参数就能解决问题”
- 真正有收益的方向仍然是：复用 WebView、减少首屏前端负担、优化 UX 呈现方式

## 七、方案性质与风险分层

### 1. 哪些属于官方支持能力

以下属于官方支持、文档明确存在的能力：

- **Tauri splashscreen / hidden main window**
- **Tauri tray / hide / show / set_focus API**
- **React `lazy` + `Suspense`**

这些都不是 hack。

其中：

- `splashscreen + hidden main` 是 Tauri 官方直接给出的模式
- `lazy + Suspense` 是 React 官方推荐的代码分割能力

### 2. 哪些属于“官方 API 之上自建架构”

`daemon + client` 不是 Tauri 内置的一键模式。

它依赖的是：

- Tauri 官方窗口 API
- Tauri tray API
- 你自己实现的 IPC
- 你自己实现的 session 生命周期
- 你自己处理 `$EDITOR` 兼容语义

所以它的性质是：

- **不是 hack**
- **但也不是官方现成可选项**
- **是基于官方 API 自己搭的产品架构**

这类方案的风险主要不在“代码能不能写出来”，而在：

- 多平台行为差异
- 进程生命周期复杂度
- 窗口恢复一致性
- 崩溃恢复与并发 session

### 3. 哪些属于平台 hack

以下就属于高风险平台特化方案：

- `xdotool`
- X11 `_NET_ACTIVE_WINDOW`
- GNOME / Wayland 定向焦点 hack
- 特定桌面环境下的外部依赖补丁

这类方案通常具备：

- 平台绑定强
- 跨平台差
- 后续维护成本高

### 4. 风险分层结论

按本项目场景，建议这样分：

#### 低风险

- release 基准与埋点
- `React.lazy` / `Suspense`
- Mermaid 按需动态加载
- `@uiw/react-markdown-preview/nohighlight` 评估
- splashscreen / skeleton / hidden-main UX

#### 中风险

- 关窗不退出，窗口 hide 后再 show
- tray 常驻
- 单进程内的“预热式体验”

#### 中高风险

- 当前这种 `daemon + client + IPC + $EDITOR` 解耦架构

#### 高风险

- Linux / GNOME / X11 焦点抢占特化
- 平台级窗口激活 hack

### 5. “常驻预热”到底是什么

“常驻预热”不是 React 概念，而是桌面应用进程 / WebView 生命周期策略。

它的含义是：

1. 第一次启动时，把进程和 WebView 建起来
2. 后续不销毁，而是继续常驻
3. 下一次用户打开时，尽量复用现有进程 / WebView
4. 把原本每次都要付出的冷启动成本，改成只付一次

可以分成三档：

- **弱预热**：进程常驻，但窗口或 WebView 仍可能重建
- **中预热**：进程常驻，窗口隐藏后恢复
- **强预热**：进程和 WebView 都常驻，只切内容和会话状态

对 `cliV` 而言，`daemon` 方案就是一种强预热路径。

### 6. daemon 与激活问题的直接关系

这个关系需要明确写出来：

- **不用 daemon**：没有“恢复旧窗口到前台”的问题，但每次都要重新冷启动
- **用了 daemon**：可以减少重复冷启动，但会立刻进入“如何恢复隐藏窗口”的问题域

也就是说：

- daemon 不是一个“只带来收益、不带来新约束”的方案
- 它几乎必然把问题从“启动慢”转移为“窗口激活”

在 GNOME 下尤其如此。

## 八、建议优先级

### P0：先做正确基准，不要继续拿 debug/dev 结果当结论

建议单独测 release：

- `src-tauri/target/release/cliv`

至少记录四个时间点：

1. 进程启动
2. `run_gui: setup done`
3. 前端 `DOMContentLoaded` / React mount
4. 首个可见内容出现

如果不先做这件事，后续所有优化都容易跑偏。

### P1：先解决“白屏观感”，不是先解决“最终内容慢”

最务实的第一步：

- 主窗口先显示极轻的壳
- 不等 Markdown、Mermaid、注释层、返回面板全部 ready
- 先让用户看到应用已经活着

可选方案：

- splashscreen
- skeleton
- 极简 loading shell

### P2：拆首屏同步包

建议重点处理：

1. `MarkdownViewer` 懒加载
2. `MermaidBlock` 改为检测到 mermaid block 时再动态 `import("mermaid")`
3. 评估 `@uiw/react-markdown-preview/nohighlight`
4. 把最重的 Markdown 能力从首屏同步路径挪走

### P3：把“打开窗口”和“加载文档”解耦

当前用户感知是：

- 调起 `cliv`
- 等很久
- 然后才看到东西

更好的流程应该是：

- 调起 `cliv`
- 立即看到轻壳
- 文档内容随后填充

这会显著降低“白屏”感受，即使总耗时未必立刻减少一半。

### P4：如果未来重启 GNOME 下 daemon 路线，要接受“不保证自动前台激活”

如果未来继续推进 daemon，更现实的产品策略已经不是“继续加激活 hack”，而是：

1. Linux 不 hide 到 tray，保留 idle window
2. 新 session 到来时刷新内容，但不承诺自动前台激活
3. `request_user_attention` 只做提醒，不当成成功语义
4. `xdotool` 如果保留，也只能是实验性 fallback
5. daemon 继续作为可选热路径，而不是唯一交互模式

这部分是对已归档实验的后续建议，不是当前主线计划。

## 九、对“是否可能直接启动也做到丝滑瞬时”的回答

可以明显改善，但很难把 Linux + WebKitGTK 冷启动做成“物理上真正 0ms”。

能做到的是：

- 把真实冷启动成本压缩
- 把不可压缩的那部分藏在更好的首屏 UX 后面
- 让用户主观上觉得“几乎瞬时”

就这个项目目前的代码结构看，最现实的路线是：

```text
release 基准
  -> 前端埋点
  -> 首屏壳 + loading
  -> MarkdownViewer 懒加载
  -> Mermaid 按需加载
  -> 视结果再决定是否保留 daemon
```

## 十、最终判断

本次问题应拆成三个独立结论：

### 结论 A：白屏和启动慢的主因

真正的冷启动 blank paint 主因是：

- WebKitGTK 冷启动
- 前端首屏主包过重
- React 首帧出现太晚

不是：

- Rust CLI 解析慢
- 当前 Tauri 插件注册慢

### 结论 B：这次复现到的“白屏”另有一条已确认的逻辑 bug

本轮用户实际遇到的“启动后一直白屏”，已确认主要是：

- 单文件模式把内容放进了 `compose`
- 却没有把它作为 `reply` 展示
- 前端因此停在 idle / welcome 态

这个问题已修复，不能再继续算到“前端首屏性能”头上。

### 结论 C：daemon 不是白屏问题的根治

daemon 能避免重复冷启动，但在 GNOME 下会引入新的窗口激活问题。  
所以 daemon 是“减少重复成本”的方案，不是“首屏白屏”问题的直接根治；而在 Linux 上，它还需要接受“不保证自动前台激活”的平台现实。

---

## 参考资料

外部：
- Tauri Splashscreen 文档：<https://v2.tauri.app/learn/splashscreen/>
- Tauri Develop 文档：<https://v2.tauri.app/develop/>
- Tauri System Tray 文档：<https://v2.tauri.app/learn/system-tray/>
- Tauri Webview Versions 文档：<https://v2.tauri.app/reference/webview-versions/>
- Tauri issue `#6310`：<https://github.com/tauri-apps/tauri/issues/6310>
- Tauri issue `#5974`：<https://github.com/tauri-apps/tauri/issues/5974>
- GTK `gtk_window_set_startup_id` 文档：<https://docs.gtk.org/gtk3/method.Window.set_startup_id.html>
- freedesktop Startup Notification 规范：<https://specifications.freedesktop.org/startup-notification-spec/0.2/>
- React `lazy` 文档：<https://react.dev/reference/react/lazy>
- Chrome warmup / prefetch 文档：<https://developer.chrome.com/docs/android/custom-tabs/guide-warmup-prefetch/>
- Microsoft WebView2 分发与运行时文档：<https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution>

本地：
- `docs/doc/issue_tauri_startup_slow.md`
- `issues/gnome-window-activation.md`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/commands/files.rs`
- `src/app/hooks/useInitDocument.ts`
- `src/app/App.tsx`
- `src/stores/documentStore.ts`
- `src/features/documents/MarkdownViewer.tsx`
- `src/features/documents/MermaidBlock.tsx`
- `src/main.tsx`
- `~/.cliv/cliv.log`
