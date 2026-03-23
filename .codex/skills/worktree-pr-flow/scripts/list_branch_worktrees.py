#!/usr/bin/env python3

import argparse
import json
import subprocess
import sys
from pathlib import Path


def run_git(args, cwd=None, check=True):
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def repo_root():
    return Path(run_git(["rev-parse", "--show-toplevel"]))


def parse_worktrees(root):
    raw = run_git(["worktree", "list", "--porcelain"], cwd=root)
    entries = []
    current = {}

    for line in raw.splitlines():
        if not line:
            if current:
                entries.append(current)
                current = {}
            continue

        key, _, value = line.partition(" ")
        if key == "worktree":
            current["path"] = value
        elif key == "HEAD":
            current["head"] = value
        elif key == "branch":
            current["branch_ref"] = value
        elif key == "detached":
            current["detached"] = True

    if current:
        entries.append(current)

    attached = {}
    detached = []

    for entry in entries:
        path = entry["path"]
        head = entry.get("head", "")
        branch_ref = entry.get("branch_ref")
        dirty = bool(run_git(["status", "--porcelain"], cwd=path))

        if branch_ref:
            branch = branch_ref.removeprefix("refs/heads/")
            attached[branch] = {
                "path": path,
                "head": head,
                "dirty": dirty,
            }
        else:
            detached.append(
                {
                    "branch": "(detached)",
                    "relation": "detached",
                    "attached": True,
                    "dirty": "dirty" if dirty else "clean",
                    "upstream": "-",
                    "ahead": "-",
                    "behind": "-",
                    "head": head[:8],
                    "path": path,
                    "subject": run_git(["log", "-1", "--format=%s", head], cwd=root),
                }
            )

    return attached, detached


def branch_rows(root, attached, base_ref):
    raw = run_git(
        [
            "for-each-ref",
            "--format=%(refname:short)\t%(objectname)\t%(upstream:short)\t%(subject)",
            "refs/heads",
        ],
        cwd=root,
    )

    base_sha = None
    if base_ref:
        base_sha = run_git(["rev-parse", "--verify", f"{base_ref}^{{commit}}"], cwd=root)

    rows = []
    for line in raw.splitlines():
        branch, head, upstream, subject = (line.split("\t", 3) + ["", "", "", ""])[:4]
        attached_info = attached.get(branch)

        if base_sha is None:
            relation = "tracked"
        elif head == base_sha:
            relation = "base"
        else:
            is_descendant = subprocess.run(
                ["git", "merge-base", "--is-ancestor", base_sha, head],
                cwd=root,
                check=False,
                capture_output=True,
                text=True,
            ).returncode == 0
            relation = "descendant" if is_descendant else "outside"

        ahead = "-"
        behind = "-"
        if upstream:
            counts = run_git(["rev-list", "--left-right", "--count", f"{branch}...{upstream}"], cwd=root)
            ahead_count, behind_count = counts.split()
            ahead = ahead_count
            behind = behind_count

        rows.append(
            {
                "branch": branch,
                "relation": relation,
                "attached": bool(attached_info),
                "dirty": (
                    "dirty"
                    if attached_info and attached_info["dirty"]
                    else "clean"
                    if attached_info
                    else "-"
                ),
                "upstream": upstream or "-",
                "ahead": ahead,
                "behind": behind,
                "head": head[:8],
                "path": attached_info["path"] if attached_info else "-",
                "subject": subject,
            }
        )

    return rows


def print_rows(rows, detached):
    if not rows and not detached:
        print("No branches or worktrees found.")
        return

    branch_width = max([len("branch"), *(len(row["branch"]) for row in rows)])
    relation_width = max([len("relation"), *(len(row["relation"]) for row in rows)])
    upstream_width = max([len("upstream"), *(len(row["upstream"]) for row in rows)])

    header = (
        f"{'branch':<{branch_width}}  "
        f"{'relation':<{relation_width}}  "
        f"{'attached':<8}  "
        f"{'dirty':<5}  "
        f"{'upstream':<{upstream_width}}  "
        f"{'ahead':>5}  "
        f"{'behind':>6}  "
        f"{'head':<8}  path"
    )
    print(header)
    print("-" * len(header))

    for row in rows:
        print(
            f"{row['branch']:<{branch_width}}  "
            f"{row['relation']:<{relation_width}}  "
            f"{('yes' if row['attached'] else 'no'):<8}  "
            f"{row['dirty']:<5}  "
            f"{row['upstream']:<{upstream_width}}  "
            f"{row['ahead']:>5}  "
            f"{row['behind']:>6}  "
            f"{row['head']:<8}  {row['path']}"
        )
        if row["subject"]:
            print(f"  subject: {row['subject']}")

    if detached:
        print("\nDetached worktrees:")
        for row in detached:
            print(f"- {row['head']} {row['path']}")
            if row["subject"]:
                print(f"  subject: {row['subject']}")


def main():
    parser = argparse.ArgumentParser(
        description="List local branches, attached worktrees, and integration-candidate state."
    )
    parser.add_argument("--base-ref", help="Base ref or commit used to mark descendant branches.")
    parser.add_argument(
        "--only-candidates",
        action="store_true",
        help="Show only branches that descend from --base-ref.",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    args = parser.parse_args()

    if args.only_candidates and not args.base_ref:
        parser.error("--only-candidates requires --base-ref")

    try:
        root = repo_root()
        attached, detached = parse_worktrees(root)
        rows = branch_rows(root, attached, args.base_ref)

        if args.only_candidates:
            rows = [row for row in rows if row["relation"] == "descendant"]

        if args.json:
            payload = {"branches": rows, "detached_worktrees": detached}
            json.dump(payload, sys.stdout, indent=2)
            sys.stdout.write("\n")
            return

        print_rows(rows, detached)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
