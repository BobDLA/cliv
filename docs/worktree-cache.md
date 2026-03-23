# Shared Caches For Git Worktrees

Use shared caches across worktrees. Do not symlink one worktree's `node_modules` into another.

## Why

- Different branches can carry different lockfiles, postinstall outputs, or generated artifacts.
- Sharing a single `node_modules` tree across worktrees causes cross-branch contamination and hard-to-debug breakage.
- `pnpm` already deduplicates packages through its global store. That is the correct layer to share.

## Recommended Setup

Run the helper once with a cache root on your larger disk:

```bash
scripts/setup_shared_worktree_cache.sh /mnt/hdd/dev-cache/cliv
source /mnt/hdd/dev-cache/cliv/cliv-worktree-env.sh
```

If you want the shared cache environment in every shell session, add the same `source` line to `~/.bashrc` or `~/.zshrc`.

The helper creates shared locations for:

- `pnpm store-dir`
- `PNPM_HOME`
- `PLAYWRIGHT_BROWSERS_PATH`

When `pnpm` is already installed, the script also configures the global `pnpm store-dir` for you.

The helper intentionally does not rewrite `CARGO_HOME` or `RUSTUP_HOME`. Pointing those homes at a brand-new directory can break an existing Rust toolchain install, so cliV leaves Rust's default homes alone unless you migrate them yourself on purpose.

## Per-Worktree Rule

Each worktree should still keep its own project-local install tree:

- `node_modules/`
- `dist/`
- `src-tauri/target/`

After opening a worktree, install dependencies normally:

```bash
pnpm install --frozen-lockfile
```

This keeps the branch-specific dependency graph isolated while still reusing the shared cache layers.

## Filesystem Note

The biggest `pnpm` disk savings happen when the shared cache root and the worktrees live on the same filesystem. In that case `pnpm` can hardlink packages from its store into each worktree.

If the cache root is on a different filesystem, the setup still centralizes downloads and browser/tool caches, but `pnpm` will not save as much space inside each worktree.

## Summary

- Share caches.
- Do not share `node_modules`.
- Prefer the same filesystem for the shared cache root and the worktrees.
