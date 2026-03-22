#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/new_worktree.sh <branch> [base-ref]

Examples:
  scripts/new_worktree.sh fix/prompt-header-reseed
  scripts/new_worktree.sh docs/worktree-policy origin/main

Rules:
  - Worktrees are created under ./.worktrees/
  - The directory name is derived from the branch by replacing / with --
  - Existing branches reuse the canonical derived path
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

resolve_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || die "run this script inside a git repository"
}

validate_branch_name() {
  local branch="$1"
  [[ "$branch" == */* ]] || die "branch must use the <type>/<slug> form: $branch"
  [[ "$branch" != *" "* ]] || die "branch must not contain spaces: $branch"
  [[ "$branch" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+$ ]] || die "branch contains unsupported characters: $branch"
}

canonical_worktree_path() {
  local repo_root="$1"
  local branch="$2"
  printf "%s/.worktrees/%s\n" "$repo_root" "${branch//\//--}"
}

find_attached_worktree() {
  local branch="$1"

  git worktree list --porcelain | awk -v target="refs/heads/$branch" '
    /^worktree / { path = substr($0, 10) }
    /^branch / && $2 == target { print path }
  '
}

resolve_base_ref() {
  if [[ $# -ge 1 && -n "$1" ]]; then
    printf "%s\n" "$1"
    return
  fi

  if git show-ref --verify --quiet refs/remotes/origin/main; then
    printf "origin/main\n"
    return
  fi

  if git show-ref --verify --quiet refs/heads/main; then
    printf "main\n"
    return
  fi

  git rev-parse --abbrev-ref HEAD
}

main() {
  if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage >&2
    exit 2
  fi

  local branch="$1"
  local requested_base="${2:-}"
  validate_branch_name "$branch"

  local repo_root
  repo_root="$(resolve_repo_root)"
  cd "$repo_root"

  local worktree_path
  worktree_path="$(canonical_worktree_path "$repo_root" "$branch")"
  mkdir -p "$repo_root/.worktrees"

  local attached_path
  attached_path="$(find_attached_worktree "$branch")"
  if [[ -n "$attached_path" ]]; then
    if [[ "$attached_path" == "$worktree_path" ]]; then
      echo "Worktree already attached:"
      echo "  branch: $branch"
      echo "  path:   $worktree_path"
      exit 0
    fi

    die "branch is already attached at a different path: $attached_path"
  fi

  [[ ! -e "$worktree_path" ]] || die "path already exists: $worktree_path"

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$worktree_path" "$branch"
    echo "Attached existing branch:"
    echo "  branch: $branch"
    echo "  path:   $worktree_path"
    exit 0
  fi

  local base_ref
  base_ref="$(resolve_base_ref "$requested_base")"
  git rev-parse --verify "$base_ref^{commit}" >/dev/null 2>&1 || die "base ref does not exist: $base_ref"

  git worktree add "$worktree_path" -b "$branch" "$base_ref"
  echo "Created worktree:"
  echo "  branch: $branch"
  echo "  base:   $base_ref"
  echo "  path:   $worktree_path"
}

main "$@"
