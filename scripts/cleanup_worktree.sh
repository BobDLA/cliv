#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/cleanup_worktree.sh <branch> [--remote] [--force]

Examples:
  scripts/cleanup_worktree.sh fix/prompt-header-reseed
  scripts/cleanup_worktree.sh fix/prompt-header-reseed --remote
  scripts/cleanup_worktree.sh fix/spike-cleanup --force

Behavior:
  - Removes the attached worktree for the branch if present
  - Deletes the local branch when it is merged into HEAD, main, or origin/main
  - --remote also deletes origin/<branch> and prunes remote refs
  - --force bypasses merge safety checks
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

find_attached_worktree() {
  local branch="$1"

  git worktree list --porcelain | awk -v target="refs/heads/$branch" '
    /^worktree / { path = substr($0, 10) }
    /^branch / && $2 == target { print path }
  '
}

branch_exists_local() {
  git show-ref --verify --quiet "refs/heads/$1"
}

branch_exists_remote() {
  git ls-remote --exit-code --heads origin "$1" >/dev/null 2>&1
}

branch_is_merged_into() {
  local branch="$1"
  local ref="$2"

  git rev-parse --verify "$ref^{commit}" >/dev/null 2>&1 || return 1
  git merge-base --is-ancestor "refs/heads/$branch" "$ref"
}

delete_local_branch() {
  local branch="$1"
  local force="$2"

  branch_exists_local "$branch" || return 0

  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$current_branch" != "$branch" ]] || die "cannot delete the currently checked out branch: $branch"

  if [[ "$force" == "true" ]]; then
    git branch -D "$branch"
    return
  fi

  if branch_is_merged_into "$branch" HEAD || \
    branch_is_merged_into "$branch" main || \
    branch_is_merged_into "$branch" origin/main; then
    git branch -D "$branch"
    return
  fi

  die "local branch is not merged into HEAD, main, or origin/main: $branch (rerun with --force if intended)"
}

main() {
  if [[ $# -lt 1 ]]; then
    usage >&2
    exit 2
  fi

  local branch=""
  local delete_remote="false"
  local force="false"

  for arg in "$@"; do
    case "$arg" in
      --remote)
        delete_remote="true"
        ;;
      --force)
        force="true"
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        if [[ -n "$branch" ]]; then
          die "unexpected argument: $arg"
        fi
        branch="$arg"
        ;;
    esac
  done

  [[ -n "$branch" ]] || die "branch is required"
  validate_branch_name "$branch"

  local repo_root
  repo_root="$(resolve_repo_root)"
  cd "$repo_root"

  local attached_path
  attached_path="$(find_attached_worktree "$branch")"
  if [[ -n "$attached_path" ]]; then
    if [[ "$attached_path" == "$repo_root" ]]; then
      die "refusing to remove the main repository worktree for branch: $branch"
    fi

    if [[ "$force" == "true" ]]; then
      git worktree remove --force "$attached_path"
    else
      git worktree remove "$attached_path"
    fi
  fi

  delete_local_branch "$branch" "$force"

  if [[ "$delete_remote" == "true" ]] && branch_exists_remote "$branch"; then
    git push origin --delete "$branch"
    git fetch origin --prune >/dev/null 2>&1 || true
  fi

  echo "Cleanup complete:"
  echo "  branch: $branch"
  if [[ -n "$attached_path" ]]; then
    echo "  removed worktree: $attached_path"
  else
    echo "  removed worktree: none attached"
  fi
  echo "  removed remote: $delete_remote"
}

main "$@"
