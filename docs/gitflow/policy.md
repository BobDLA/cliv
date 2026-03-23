# Gitflow Guard Policy

Use this default stage split unless the repository has a strong reason to differ.

## Branch And Worktree Policy

Use a consistent worktree workflow for implementation work.

Required defaults:

- Open a dedicated git worktree for code changes.
- Keep worktrees under `./.worktrees/` only.
- Use one task, one branch, one worktree.
- Do not create ad-hoc worktrees in random filesystem locations.
- Name branches as `<type>/<slug>`.
- Name worktree directories from the branch name by replacing `/` with `--`.

Examples:

- Branch `fix/prompt-header-reseed` -> worktree `./.worktrees/fix--prompt-header-reseed`
- Branch `feat/history-replay` -> worktree `./.worktrees/feat--history-replay`
- Branch `docs/worktree-policy` -> worktree `./.worktrees/docs--worktree-policy`

Recommended commands:

```bash
scripts/new_worktree.sh fix/prompt-header-reseed
scripts/new_worktree.sh fix/prompt-header-reseed
scripts/cleanup_worktree.sh fix/prompt-header-reseed
scripts/cleanup_worktree.sh fix/prompt-header-reseed --remote
```

Shared cache rule:

- Share cache layers across worktrees, not `node_modules`.
- Use `scripts/setup_shared_worktree_cache.sh <shared-root>` to prepare shared `pnpm`, Cargo/Rustup, and Playwright cache locations.
- Keep the shared cache root on the same filesystem as the worktrees when possible so `pnpm` can hardlink efficiently.
- See `docs/worktree-cache.md` for the full setup.

Cleanup rule:

- Remove the worktree as soon as the branch is merged or abandoned.
- Delete the local branch after removing the worktree.
- Delete the remote branch when it is no longer needed.

## Standard Delivery Loop

Recommended default loop for implementation work:

1. Sync the base branch you want to start from.
2. Create a canonical worktree with `scripts/new_worktree.sh <type>/<slug>`.
3. Implement in that worktree only.
4. Run the minimum validation set required by the changed area.
5. Record validation in PR or review notes using a `Ran / Not run` block.
6. Open or update the PR.
7. After merge, run `scripts/cleanup_worktree.sh <type>/<slug> --remote`.

Validation guidance:

- Small UI changes: prefer targeted Vitest first, not full CI locally.
- Cross-boundary changes: promote to the next validation layer instead of guessing.
- Bug fixes: prefer automated regression coverage; if not possible yet, record manual verification and the reason.

CI failure triage:

- Check the latest failed GitHub Actions run first, not only local assumptions.
- Identify the exact failing step before changing code or workflow files.
- If the failure is CI-only, record the root cause in the PR before merging.

## `pre-commit`

Keep it fast. Target sub-second to low-single-digit seconds.

Recommended checks:

- staged secret scan on added lines
- blocked path scan for `.env`, `*.pem`, `*.key`, `secrets/`
- optional formatter or lint if already fast in the repo

Do not put long test suites here by default.

## `commit-msg`

Use for policy that depends on the commit message only.

Recommended checks:

- obvious secret material in commit message
- optional conventional commit validation

## `pre-push`

Treat this as the final local outbound gate.

Recommended checks:

- pending push secret scan
- blocked path scan across pending push files
- one or two critical tests if the repo already has a stable fast path

This is the recommended first hook to enable for a new repo.

## CI / Platform

Use for team-wide enforcement:

- full repository scan
- branch protection
- organizational secret scanning
- complete test suite

## Default blocked paths

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `secrets/`
- `credentials/`

Tune these in `.gitflow-guard.json`.

## Allowlist strategy

Keep allowlists explicit and small.

Recommended allowlist use:

- fake fixtures
- known sample tokens in documentation
- deterministic test snapshots

Avoid broad allowlists that hide real leaks.
