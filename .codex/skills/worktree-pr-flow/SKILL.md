---
name: worktree-pr-flow
description: Coordinate the cliV repository's multi-worktree PR lifecycle. Use when Codex needs to batch-integrate multiple local branches or worktrees into one PR, check whether source worktrees have uncommitted changes that must be committed first, filter candidate branches by a base ref or explicit include/exclude list, rebuild a polluted PR on a fresh integration branch, inspect GitHub review threads and review state, check Actions status, land follow-up fixes, or clean up the integration worktree after merge.
---

# Worktree PR Flow

## Overview

Use this skill inside the `cliv` repo when the task is not just reviewing one PR, but coordinating the full integration loop across multiple worktrees and one PR branch.

Read `AGENTS.md` and `docs/testing-standard.md` before changing code or judging merge readiness.

## Inputs To Pin Down

Make these explicit before merging:

- the base ref or commit that defines the integration window
- the include or exclude branch list
- whether an existing PR should be updated or replaced
- the minimum validation expected for the touched areas

If the user gives only a partial scope, infer the rest from git history and state the inferred scope back in one sentence before making changes.

## Workflow

1. Refresh repo and GitHub state first.
   - Run `git fetch --all --prune`.
   - Re-check any existing PR after the fetch. Do not trust an earlier `mergeStateStatus` or local branch comparison.
2. Inventory local branches and attached worktrees before opening the integration branch.
   - Run `python3 .codex/skills/worktree-pr-flow/scripts/list_branch_worktrees.py --base-ref <ref>`.
   - Use `--only-candidates` when the user wants only descendants of a base ref.
   - Treat existing `integration/` and `backup/` branches as bookkeeping, not source candidates, unless the user explicitly asks to reuse them.
   - Treat detached worktrees as inspection-only until you know what branch they belong to.
3. Preserve source work before merging.
   - If an attached source worktree is dirty and the changes clearly belong to that branch, commit them on the source branch first.
   - If a dirty worktree contains mixed or unclear changes, stop and ask instead of making a guessed commit.
   - If a source branch is ahead of its upstream, push it before evaluating PR state so GitHub reflects the same commits you are merging.
4. Create or reuse a dedicated integration worktree.
   - Use `scripts/new_worktree.sh integration/<slug> <base-ref>`.
   - Keep integration work under `./.worktrees/`. Do not merge from the main checkout.
   - If the old integration branch has unrelated history or wrong scope, create a fresh integration branch instead of trying to salvage the old one.
5. Merge selected branches in an explicit order.
   - Merge dependency or infrastructure branches first.
   - Use `git merge --no-ff <branch>` so each source branch remains visible in history.
   - After each conflict, explain what won and what was intentionally kept.
   - If the user excludes branches, keep them out even if they are recent or attached locally.
6. Validate during the merge, not only at the end.
   - Run the minimum commands required by `docs/testing-standard.md` for the files touched so far.
   - Prefer targeted tests after each risky merge and a final combined pass before pushing.
   - Record both `Ran` and `Not run` items for the PR body or closeout note.
7. Push and create or rebuild the PR cleanly.
   - Use `gh pr create --base <base-branch> --head <integration-branch> --title <title> --body-file <file>` for a new PR.
   - Use `gh pr edit <n> --title <title> --body-file <file>` when the branch stays the same but the summary must be corrected.
   - If a prior PR is superseded, close it with `gh pr close <n> --comment 'Superseded by #<new>'`.
   - Use `--body-file` or `--body-file -` for PR descriptions and comments. Avoid shell-quoted multiline Markdown bodies.
8. Read review feedback in GitHub's highest-signal order.
   - Read unresolved review threads first.
   - Then read review summaries.
   - Then read ordinary PR conversation comments for scope changes or follow-up decisions.
   - Use the query snippets in `references/github-queries.md`.
9. Classify every nontrivial review comment before acting.
   - `still valid, blocking`
   - `still valid, non-blocking`
   - `already fixed in current PR branch`
   - `stale because code or base moved`
   - `preference only`
   - Do not dismiss bot comments without checking the current code and current PR head.
10. Check Actions on the current PR head, not an old SHA.
    - Run `gh pr checks <n>`.
    - Inspect `statusCheckRollup` or the run URL from `gh pr view` when a failing job needs more detail.
    - Do not report `ready` if the latest pushed commit has not finished required checks.
11. Apply follow-up fixes on the right branch.
    - If the problem only exists in the integration result, fix it on the integration branch.
    - If the problem belongs to a still-active source branch that will be re-merged, fix it there and re-merge deliberately.
    - After each fix, rerun the minimum validation for the affected files, push, and update the PR discussion with evidence.
12. Close out cleanly.
    - Say `can merge now` only when the goal is still present, blocking comments are addressed or explicitly invalidated, and required checks are green or the remaining gap is clearly documented.
    - After merge, remove obsolete integration worktrees and branches with `scripts/cleanup_worktree.sh <branch> [--remote]`.
    - Do not delete source worktrees that are still unmerged, still under review, or still loaded elsewhere.

## Decision Bar

Do not say an integration PR is ready unless all of the following are true:

1. The branch selection still matches the user's requested scope.
2. No source worktree lost uncommitted work during integration.
3. The current PR head contains every intended fix.
4. Blocking review threads are resolved or explicitly explained as stale.
5. Required local validation and current GitHub checks are both accounted for.

## Common Pitfalls

1. Merging every local worktree instead of only the branches descended from the requested base ref.
2. Folding dirty source work into the integration branch without first preserving it on the source branch.
3. Reusing an integration branch whose history is already polluted by unrelated merges.
4. Judging review status from top-level summaries and missing unresolved line comments.
5. Looking at passing Actions from an earlier push instead of the current PR head.
6. Editing PR bodies or comments with shell-sensitive inline Markdown instead of `--body-file`.
7. Deleting a worktree that still represents the only convenient handle for a live branch.

## Resources

- `scripts/list_branch_worktrees.py`: show local branches, attached worktrees, dirty state, upstream divergence, and whether a branch descends from a base ref
- `references/github-queries.md`: reusable `gh` and GraphQL commands for PR state, review threads, comments, and checks
