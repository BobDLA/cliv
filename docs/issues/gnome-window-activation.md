# GNOME 窗口激活问题：daemon 模式下 hide→show 无法将窗口弹到前台

> 归档说明（2026-03-20）
> 本文记录的是 `feat/daemon-hot-restart` 分支上的实验与复盘，保留作研究材料。
> 文中提到的 daemon、idle window、`enter-idle`、single-instance 等实现，不代表当前主线代码状态。

## 背景

### 原始任务：daemon-hot-restart

cliV 是命令行启动的桌面 GUI 审阅器（Tauri v2 + React），通过 `$EDITOR=cliv` 被 AI agent（Codex/Claude/Gemini）唤起。每次唤起都是一个新进程，WebView (WebKitGTK) 冷启动耗时 **~2.26 秒**。

### 为什么需要 daemon

1. **启动慢**：每次 `Ctrl+G` 唤起 cliV 都要等 2+ 秒（WebView 冷启动），Rust 侧逻辑 ~0ms
2. **`$EDITOR` 合约冲突**：`$EDITOR` 要求进程退出 = 编辑完成。常驻后台（tray 模式）与此矛盾 — 如果不退出，agent 一直等待
3. **并发问题**：第一个文档没审完，用户又 `Ctrl+G` 唤起第二个，需要友好拒绝

### 设计方案

解耦为 **daemon + 轻量 client**：

```
cliv /tmp/compose.md
    ↓
检测 ~/.cliv/cliv.sock 可连接？
    ├── 否 → 进入 daemon 模式（启动 WebView + socket server + tray）
    └── 是 → 进入 client 模式（发送 open → 阻塞等 done → exit(0)）
```

- 同一个 `cliv` binary，自动判断模式
- JSON lines 协议通过 Unix domain socket 通信
- 一次一个 session，并发拒绝 + 友好报错
- `$EDITOR` 合约不变：client 进程阻塞到审阅完成后 exit(0)

### 已完成的变更

| 文件 | 变更 |
|---|---|
| `src-tauri/src/ipc.rs` | **[NEW]** Unix socket server + SessionLock + JSON protocol |
| `src-tauri/src/client.rs` | **[NEW]** 轻量 CLI client (connect → send open → block done) |
| `src-tauri/src/main.rs` | **[MOD]** cache 子命令优先 → socket 检测 → client/daemon 分流 |
| `src-tauri/src/lib.rs` | **[MOD]** 移除 single-instance 插件，集成 daemon IPC + smart close |
| `src-tauri/src/cli.rs` | **[MOD]** CliArgs 添加 Default derive |
| `src-tauri/Cargo.toml` | **[MOD]** 移除 `tauri-plugin-single-instance` |
| `openspec/changes/daemon-hot-restart/` | **[NEW]** proposal, design, specs, tasks (4/4 artifact) |

### 发现此问题的过程

daemon IPC 全链路测试通过后，进入窗口恢复测试：daemon 收到新 session → 需要将隐藏的窗口弹到前台。发现 GNOME 桌面下所有 Tauri 窗口恢复 API 均失效。

## 状态

daemon IPC 架构已实现并工作正常：
- ✅ Unix socket server (`~/.cliv/cliv.sock`) 启动、监听
- ✅ Client 连接、发送 open 请求、阻塞等待 done
- ✅ Session lock 防并发（busy 拒绝第二个 client）
- ✅ 关窗 → session complete → client exit(0) → agent 继续
- ✅ Tray 图标 + 菜单正常
- ❌ **窗口 hide 后无法通过 show()/set_focus() 弹到前台**

## 问题

GNOME 桌面环境（X11）有 **focus-stealing prevention** 策略。当 Tauri 窗口通过 `window.hide()` 隐藏后，以下 API 全部无效：

| 尝试的方案 | 结果 |
|---|---|
| `show()` + `set_focus()` | 窗口恢复但不到前台 |
| `run_on_main_thread` 包裹 | 同上 |
| `set_always_on_top(true/false)` toggle | 无效 |
| `minimize()` + `unminimize()` | `unminimize()` 在 GNOME 无效 (Tauri#5974) |
| `destroy()` + `WebviewWindowBuilder::new()` | `destroy()` 不释放 label → "already exists" 错误 |
| `xdotool windowactivate` | 日志可返回成功，但在本机 GNOME/X11 上仍不构成可靠前台激活；且增加外部依赖，不跨平台 |
| `request_user_attention(Critical)` | 任务栏闪烁，但窗口不弹出 |

## 上游 Issue

- **tauri-apps/tauri#6310** — "Cannot have focus on Ubuntu GNOME"（Open, 2023-02 至今未修）
- **tauri-apps/tauri#5974** — "window.unminimize() not working on Linux"（Closed: not_planned）
- Tauri 团队确认这是 GNOME WM restriction，非 Tauri bug，"calling the right GTK methods"

## 根因分析

GNOME 的 Mutter WM 严格执行 [EWMH focus-stealing prevention](https://specifications.freedesktop.org/wm-spec/latest/):
- 应用程序不能主动抢占焦点
- 只有用户交互（点击、键盘）触发的窗口激活才被允许
- `_NET_ACTIVE_WINDOW` client message 可以绕过，但需要 X11 级别的代码

## 可能的解决方向

### 方向 A：接受限制，用 `request_user_attention` 闪烁任务栏
- **优点**：纯 Tauri API，跨平台，稳定
- **缺点**：用户需要多点一下任务栏才能看到窗口
- **适用场景**：如果用户能接受"闪烁提醒 + 点击恢复"的交互

### 方向 B：直接发送 `_NET_ACTIVE_WINDOW` X11 消息
- 使用 `x11rb` 或 `xcb` crate 发送 X11 client message
- GNOME 对来自 root window 的 `_NET_ACTIVE_WINDOW` 消息会响应
- **优点**：真正弹出窗口，无需外部工具
- **缺点**：新增 Rust 依赖（`x11rb`），仅 X11 生效（不支持 Wayland）
- **适用场景**：如果必须自动弹出且目标平台是 Linux X11

### 方向 C：利用 GNOME Extension 或 D-Bus 接口
- GNOME Shell 有 `org.gnome.Shell` D-Bus 接口可以 `FocusWindow`
- **优点**：不依赖 X11，Wayland 也可用
- **缺点**：依赖 GNOME Shell 版本，非通用方案

### 方向 D：不 hide 窗口，关窗时显示空白等待页面
- 关窗时不 hide，改为导航到 "等待下一个文档..." 占位页
- 新 session 到来时直接 reload 内容
- **优点**：完全避免 hide/show 问题
- **缺点**：窗口始终占据任务栏位置

### 方向 E：条件编译平台适配
- Linux X11：用 `_NET_ACTIVE_WINDOW`
- Linux Wayland：用 `request_user_attention`（目前 Wayland 也有同样问题）
- macOS/Windows：Tauri 的 `show()` + `set_focus()` 正常工作

## 当时实验分支的代码状态

```
src-tauri/src/ipc.rs                — socket server + session lock ✅
src-tauri/src/client.rs             — lightweight CLI client ✅
src-tauri/src/main.rs               — cache/client/daemon routing ✅
src-tauri/src/lib.rs                — daemon integration, Linux activation experiments,
                                      idle-window close path ✅
src/app/hooks/useInitDocument.ts    — listen "enter-idle" and clear active document ✅
src/stores/documentStore.ts         — idle reset support ✅
```

IPC 全链路正常，唯一问题是 GNOME 下窗口激活。

## 复审结论（2026-03-19）

原分析方向大体正确，但有几处结论下得过早，需要明确修正：

1. **`show()` / `set_focus()` / GTK `present_with_time()` 不是彼此独立的尝试。**
   在当前依赖栈里，Tauri `set_focus()` 最终已经走到 `tao` 的 `window.present_with_time(GDK_CURRENT_TIME)`。因此“换成 GTK present”本身并不构成新的技术路线，除非同时带上有效的 activation token / startup id。

2. **“`unminimize()` 在 GNOME 无效”这个结论已经过时。**
   `tauri-apps/tauri#5974` 在 2025-04-21 和 2025-06-05 的最新评论表明，`hide -> unminimize -> show -> set_focus` 在 Ubuntu 24、Ubuntu 25.04 + GNOME 48 上可以工作。也就是说，之前的排查没有覆盖到新的 restore 顺序。

3. **根因不应表述为 “GNOME 专属 bug”。**
   `tauri-apps/tauri#6310` 的后续讨论显示 KDE Plasma 也能复现类似现象。更准确的表述是：
   - 这是现代 Linux WM / Shell 的 focus-stealing prevention 策略
   - GNOME 更严格、更常见
   - Tauri 当前公开 API 没有替应用传递 activation context

4. **`xdotool windowactivate` 有效，不等于普通应用直接发 `_NET_ACTIVE_WINDOW` 也等价有效。**
   `xdotool` 源码里发送 `_NET_ACTIVE_WINDOW` 时把 source indication 设成了 `2`（pager），不是普通 application request。这个细节决定了它可以作为 X11 fallback，但不能被当成“标准 Tauri API 本该做到”的直接证据。

5. **之前没有验证“跨进程激活上下文传递”这条路。**
   GTK 官方文档说明 `gtk_window_set_startup_id()` 就是为“把焦点从一个进程转交给另一个进程”准备的；GNOME 官方讨论也明确指出，Wayland/X11 的正确方向都是把 activation token / startup id 从 source process 传到 target process，而不是在目标进程里盲目 `present()`。

## 当时已落地尝试

已在实验分支代码里实现过一版保守修复：

- client 进程透传 `XDG_ACTIVATION_TOKEN` / `DESKTOP_STARTUP_ID`
- daemon 在 Linux 上调用 `gtk_window.set_startup_id(...)`
- Linux 恢复顺序改为 `hide -> unminimize -> show -> set_focus`
- X11 会额外发送 `_NET_ACTIVE_WINDOW` 作为 fallback（行为对齐 `xdotool`）
- Linux 关窗不再 hide 到 tray，而是保留可见 idle window；前端收到 `enter-idle` 后清空当前文档状态

当时对应代码：

- `src-tauri/src/client.rs`
- `src-tauri/src/ipc.rs`
- `src-tauri/src/lib.rs`
- `src/app/hooks/useInitDocument.ts`
- `src/stores/documentStore.ts`

这些路径仅用于标记实验分支里当时的实现位置，不代表当前主线仍保留这些逻辑。

## 仍然存在的限制

- Wayland 下是否一定能拿到有效 token，取决于启动来源；从 terminal/agent 链路唤起时，token 可能本来就不存在
- X11 fallback 借鉴了 `xdotool` 的 pager-style `_NET_ACTIVE_WINDOW`，属于实用主义兼容方案，不是严格“纯应用请求”语义
- GNOME/X11 已完成人工验收，结果是：在当前 terminal/agent 启动链路里即使 `xdotool` 返回成功，也仍然不能承诺自动前台激活；Wayland 仍未单独验收

## 二次验证结果（2026-03-19）

这一轮不是只停留在“看上游 issue”，而是把几条路线都落地后在真实 GNOME/X11 会话里复测了。结论比前一版更清楚：

1. **当前启动链路通常没有 activation token。**
   `~/.cliv/cliv.log` 已记录：
   - `ipc-open: ... activation_token=false`

   这意味着即使代码已经支持 client 透传 `XDG_ACTIVATION_TOKEN` / `DESKTOP_STARTUP_ID`，从当前 terminal/agent 链路唤起时，大多数情况下也根本拿不到可用 token。没有有效 activation context，GTK `present_with_time()` / `set_startup_id()` 这条路天然就不稳。

2. **`xdotool` 日志成功，不等于用户真的看到窗口到了前台。**
   同一轮日志里还能看到：
   - `window activation: xdotool windowactivate succeeded`

   但人工验收结果仍然是“没有被激活到前台”。所以这里必须修正结论：
   - `xdotool` 最多只能算实验性 X11 fallback
   - 它不能被当成产品级、可保证的恢复机制
   - 更不应该成为跨平台主方案

3. **idle window 试验能解决 hide/restore 路径问题，但不能解决“强制抢前台”问题。**
   在当时的实验分支里，Linux 一度改成：
   - 关窗时不 hide 到 tray
   - Rust 发 `enter-idle`
   - 前端清空当前文档，回到待机态

   日志已记录：
   - `idle: frontend switched to idle state`
   - `close: window kept visible in idle mode`

   这证明窗口本身保持 `IsViewable` 没问题，也避免了最脆弱的 `hide -> show` 恢复链路。但用户实测仍然反馈“还是无法激活”，说明问题已经收敛到更本质的一点：**GNOME/X11 上无法把“可见窗口”稳定提升为“自动拿到前台焦点”**。

4. **测试过程里遇到的“白屏”是另一类问题，不应混入窗口激活结论。**
   手工验收时一度出现“启动后一直白屏”，后来确认那不是激活失败本身，而是单文件模式的加载 bug：
   - `cliv /tmp/test.md` 在没有 metadata 的情况下，把文件读进了 `compose`
   - 但没有把它当作 `reply`
   - 前端因此回到了 idle / welcome 态，看起来像“白屏”

   这个问题已在 `src-tauri/src/commands/files.rs` 修复，并补了测试。它和 GNOME 激活限制是两个独立问题。

## 更新后的结论

到这一步可以定性：

- `show()` / `set_focus()` / `present_with_time()` 不是缺最后一个调用顺序的问题
- `activation token` 在当前启动链路里通常缺失，这是恢复失败的重要前提条件
- 即使补上 `xdotool` / X11 fallback，也仍然不够可靠，不能继续往“保证自动前台激活”这个目标投入

更现实的产品方向应该改成：

1. **如果未来重启 daemon 路线，Linux 不应再依赖 hide 到 tray 再恢复。**
   idle window 可以作为候选策略，但它只是当时实验结论，不是当前主线行为。

2. **Linux 不承诺自动前台激活。**
   可以保留 `show()` / `request_user_attention()` 作为尽力而为的提醒，但文档和实现上都不应承诺“下一次一定跳到前台”。

3. **`xdotool` 如果保留，也只能是可选实验性 fallback。**
   它不应该是默认成功路径，更不应该成为跨平台设计基础。

4. **macOS / Windows 继续使用原生 `show + focus`。**
   把 Linux 当作单独的产品策略处理，而不是要求三端共享同一套“强制激活”语义。

## 参考资料

- EWMH `_NET_ACTIVE_WINDOW` / focus-stealing prevention：<https://specifications.freedesktop.org/wm-spec/latest/>
- freedesktop Startup Notification 规范：<https://specifications.freedesktop.org/startup-notification-spec/0.2/>
- GTK `gtk_window_set_startup_id` 文档：<https://docs.gtk.org/gtk3/method.Window.set_startup_id.html>
- GNOME cross-process activation 讨论：<https://discourse.gnome.org/t/cross-process-window-activation-on-wayland/20306>
- Tauri issue `#6310`：<https://github.com/tauri-apps/tauri/issues/6310>
- Tauri issue `#5974`：<https://github.com/tauri-apps/tauri/issues/5974>
