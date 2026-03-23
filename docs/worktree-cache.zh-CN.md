# Git Worktree 共享缓存说明

可以在多个 worktree 之间共享缓存，但不要把一个 worktree 的 `node_modules` 软链接给另一个 worktree。

## 原因

- 不同分支可能对应不同的 lockfile、`postinstall` 结果或生成产物。
- 多个 worktree 共用一份 `node_modules` 很容易产生跨分支污染，问题通常隐蔽且难排查。
- `pnpm` 本来就会通过全局 store 去重依赖。真正应该共享的是这一层，而不是项目内的安装树。

## 推荐做法

先在大容量磁盘上准备一个共享缓存根目录，然后运行仓库脚本：

```bash
scripts/setup_shared_worktree_cache.sh /mnt/hdd/dev-cache/cliv
source /mnt/hdd/dev-cache/cliv/cliv-worktree-env.sh
```

如果希望每次打开 shell 都自动使用这套共享缓存，把同一行 `source` 加到 `~/.bashrc` 或 `~/.zshrc`。

脚本会准备这些共享位置：

- `pnpm store-dir`
- `PNPM_HOME`
- `PLAYWRIGHT_BROWSERS_PATH`

如果系统里已经安装了 `pnpm`，脚本还会顺手帮你配置全局 `pnpm store-dir`。

这个 helper 故意不会改写 `CARGO_HOME` 或 `RUSTUP_HOME`。如果把现有 Rust 安装直接指向一个全新的目录，往往会让已有 toolchain 失效，所以 cliV 默认保留 Rust 现有的 home 位置；只有在你明确手动迁移时才应该修改它们。

## 每个 Worktree 仍然要独立保留的内容

每个 worktree 仍然应该保留自己独立的项目级目录：

- `node_modules/`
- `dist/`
- `src-tauri/target/`

进入新的 worktree 后，照常安装依赖：

```bash
pnpm install --frozen-lockfile
```

这样既能复用共享缓存层，又不会让不同分支的依赖树互相污染。

## 文件系统注意事项

当共享缓存根目录和 worktree 位于同一个文件系统时，`pnpm` 可以把 store 里的内容 hardlink 到各个 worktree，节省空间的效果最好。

如果两者位于不同文件系统，依然能共享下载缓存、浏览器缓存和工具缓存，但 `pnpm` 在每个 worktree 内节省的空间会明显变少。

## 结论

- 可以共享缓存。
- 不要共享 `node_modules`。
- 共享缓存根目录最好和 worktree 放在同一个文件系统上。
