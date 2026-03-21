#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable


MANAGED_HEADER = "# managed by gitflow_guard.py"
CONFIG_NAME = ".gitflow-guard.json"
DEFAULT_HOOKS = ["pre-push"]
SUPPORTED_HOOKS = {"pre-commit", "pre-push", "commit-msg"}


DEFAULT_CONFIG = {
    "blocked_paths": [
        r"(^|/)\.env(\..+)?$",
        r".*\.pem$",
        r".*\.key$",
        r"(^|/)secrets(/|$)",
        r"(^|/)credentials(/|$)",
    ],
    "allowlist": [
        r"example[_-]?token",
        r"fake[_-]?secret",
        r"test[_-]?key",
        r"placeholder",
    ],
    "patterns": [
        {
            "name": "OpenAI key",
            "regex": r"sk-[A-Za-z0-9_-]{20,}",
        },
        {
            "name": "GitHub token",
            "regex": r"(ghp|github_pat)_[A-Za-z0-9_]{20,}",
        },
        {
            "name": "AWS access key",
            "regex": r"AKIA[0-9A-Z]{16}",
        },
        {
            "name": "Private key block",
            "regex": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
        },
        {
            "name": "Bearer token",
            "regex": r"Bearer\s+[A-Za-z0-9._-]{20,}",
        },
        {
            "name": "Generic credential assignment",
            "regex": r"(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]",
        },
    ],
    "commit_message_patterns": [
        {
            "name": "Commit message secret",
            "regex": r"(?i)(api[_-]?key|secret|token|password|bearer)\b.{0,80}",
        }
    ],
}


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Install and run project-local Git flow guards.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    install = subparsers.add_parser("install", help="Install managed Git hooks.")
    add_common_repo_args(install)
    install.add_argument(
        "--hooks",
        default=",".join(DEFAULT_HOOKS),
        help="Comma-separated hooks to install: pre-commit,pre-push,commit-msg",
    )
    install.set_defaults(func=cmd_install)

    scan = subparsers.add_parser("scan", help="Run the configured checks.")
    add_common_repo_args(scan)
    scan.add_argument(
        "--stage",
        choices=["pre-commit", "pre-push", "commit-msg"],
        required=True,
        help="Which stage policy to execute.",
    )
    scan.add_argument("--commit-msg-file", help="Commit message file path for commit-msg stage.")
    scan.set_defaults(func=cmd_scan)

    status = subparsers.add_parser("status", help="Show current managed hook status.")
    add_common_repo_args(status)
    status.set_defaults(func=cmd_status)

    uninstall = subparsers.add_parser("uninstall", help="Remove managed hooks.")
    add_common_repo_args(uninstall)
    uninstall.set_defaults(func=cmd_uninstall)

    run_hook = subparsers.add_parser("_run-hook", help=argparse.SUPPRESS)
    add_common_repo_args(run_hook)
    run_hook.add_argument("--hook", choices=sorted(SUPPORTED_HOOKS), required=True)
    run_hook.add_argument("hook_args", nargs="*")
    run_hook.set_defaults(func=cmd_run_hook)

    return parser


def add_common_repo_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--root", default=".", help="Repository root.")


def cmd_install(args: argparse.Namespace) -> int:
    repo = resolve_repo_root(args.root)
    config_path = ensure_config(repo)
    hooks = parse_hooks(args.hooks)
    script_path = repo / "scripts" / "gitflow_guard.py"
    if not script_path.exists():
        script_path = Path(__file__).resolve()
    for hook in hooks:
        install_hook(repo, hook, script_path)
    print(f"Installed hooks: {', '.join(hooks)}")
    print(f"Config: {config_path}")
    return 0


def cmd_scan(args: argparse.Namespace) -> int:
    repo = resolve_repo_root(args.root)
    config = load_config(repo)
    if args.stage == "pre-commit":
        findings = scan_pre_commit(repo, config)
    elif args.stage == "pre-push":
        findings = scan_pre_push(repo, config, sys.stdin.read().splitlines())
    else:
        if not args.commit_msg_file:
            raise SystemExit("--commit-msg-file is required for commit-msg stage")
        findings = scan_commit_message(Path(args.commit_msg_file), config)
    return report_findings(args.stage, findings)


def cmd_status(args: argparse.Namespace) -> int:
    repo = resolve_repo_root(args.root)
    config_path = repo / CONFIG_NAME
    print(f"Repo: {repo}")
    print(f"Config present: {'yes' if config_path.exists() else 'no'}")
    print(f"gitleaks available: {'yes' if shutil.which('gitleaks') else 'no'}")
    for hook in sorted(SUPPORTED_HOOKS):
        hook_path = repo / ".git" / "hooks" / hook
        managed = hook_path.exists() and MANAGED_HEADER in hook_path.read_text()
        print(f"{hook}: {'managed' if managed else 'missing'}")
    return 0


def cmd_uninstall(args: argparse.Namespace) -> int:
    repo = resolve_repo_root(args.root)
    removed: list[str] = []
    for hook in SUPPORTED_HOOKS:
        hook_path = repo / ".git" / "hooks" / hook
        if hook_path.exists() and MANAGED_HEADER in hook_path.read_text():
            hook_path.unlink()
            removed.append(hook)
    if removed:
        print(f"Removed hooks: {', '.join(sorted(removed))}")
    else:
        print("No managed hooks found.")
    print(f"Config kept: {repo / CONFIG_NAME}")
    return 0


def cmd_run_hook(args: argparse.Namespace) -> int:
    repo = resolve_repo_root(args.root)
    config = load_config(repo)
    if args.hook == "pre-commit":
        findings = scan_pre_commit(repo, config)
    elif args.hook == "pre-push":
        findings = scan_pre_push(repo, config, sys.stdin.read().splitlines())
    else:
        if not args.hook_args:
            print("commit-msg hook requires the message file path", file=sys.stderr)
            return 2
        findings = scan_commit_message(Path(args.hook_args[0]), config)
    return report_findings(args.hook, findings)


def resolve_repo_root(root_arg: str) -> Path:
    root = Path(root_arg).resolve()
    if not (root / ".git").exists():
        result = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise SystemExit(f"Not a Git repository: {root}")
        root = Path(result.stdout.strip())
    return root


def ensure_config(repo: Path) -> Path:
    path = repo / CONFIG_NAME
    if not path.exists():
        path.write_text(json.dumps(DEFAULT_CONFIG, indent=2) + "\n")
    return path


def load_config(repo: Path) -> dict:
    config_path = ensure_config(repo)
    return json.loads(config_path.read_text())


def parse_hooks(raw: str) -> list[str]:
    hooks = [item.strip() for item in raw.split(",") if item.strip()]
    invalid = [hook for hook in hooks if hook not in SUPPORTED_HOOKS]
    if invalid:
        raise SystemExit(f"Unsupported hooks: {', '.join(invalid)}")
    return hooks


def install_hook(repo: Path, hook: str, script_path: Path) -> None:
    hook_path = repo / ".git" / "hooks" / hook
    hook_path.parent.mkdir(parents=True, exist_ok=True)
    root = sh_quote(str(repo))
    script = sh_quote(str(script_path))
    content = f"""#!/usr/bin/env bash
{MANAGED_HEADER}
set -euo pipefail
python3 {script} _run-hook --root {root} --hook {hook} "$@"
"""
    hook_path.write_text(content)
    hook_path.chmod(0o755)


def scan_pre_commit(repo: Path, config: dict) -> list[dict]:
    lines = git_stdout(repo, ["diff", "--cached", "--unified=0", "--no-color", "--diff-filter=AM"]).splitlines()
    return scan_diff_lines(lines, config, path_only=False)


def scan_pre_push(repo: Path, config: dict, stdin_lines: list[str]) -> list[dict]:
    findings: list[dict] = []
    if stdin_lines:
        for line in stdin_lines:
            parts = line.strip().split()
            if len(parts) != 4:
                continue
            _local_ref, local_sha, _remote_ref, remote_sha = parts
            if is_zero_sha(local_sha):
                continue
            if is_zero_sha(remote_sha):
                merge_base = git_optional_stdout(repo, ["merge-base", local_sha, "HEAD"])
                base = merge_base.strip() if merge_base else f"{local_sha}^"
            else:
                base = remote_sha
            diff_lines = git_stdout(
                repo,
                ["diff", "--unified=0", "--no-color", "--diff-filter=AM", f"{base}..{local_sha}"],
            ).splitlines()
            findings.extend(scan_diff_lines(diff_lines, config, path_only=False))
    else:
        findings.extend(scan_pre_commit(repo, config))
    return findings


def scan_commit_message(message_path: Path, config: dict) -> list[dict]:
    text = message_path.read_text() if message_path.exists() else ""
    findings = []
    allowlist = [re.compile(item) for item in config.get("allowlist", [])]
    for idx, line in enumerate(text.splitlines(), start=1):
        if is_allowlisted(line, allowlist):
            continue
        for rule in config.get("commit_message_patterns", []):
            if re.search(rule["regex"], line):
                findings.append(
                    {
                        "kind": "commit-msg",
                        "name": rule["name"],
                        "path": str(message_path),
                        "line": idx,
                        "preview": redact(line),
                    }
                )
    return findings


def scan_diff_lines(lines: list[str], config: dict, path_only: bool) -> list[dict]:
    findings: list[dict] = []
    current_file = ""
    current_line = 0
    blocked_paths = [re.compile(item) for item in config.get("blocked_paths", [])]
    allowlist = [re.compile(item) for item in config.get("allowlist", [])]
    patterns = [(item["name"], re.compile(item["regex"])) for item in config.get("patterns", [])]

    for raw in lines:
        if raw.startswith("+++ b/"):
            current_file = raw[6:]
            current_line = 0
            if path_matches(current_file, blocked_paths):
                findings.append(
                    {
                        "kind": "path",
                        "name": "Blocked path",
                        "path": current_file,
                        "line": 0,
                        "preview": current_file,
                    }
                )
            continue
        if raw.startswith("@@"):
            match = re.search(r"\+(\d+)", raw)
            current_line = int(match.group(1)) if match else 0
            continue
        if not raw.startswith("+") or raw.startswith("+++"):
            continue
        content = raw[1:]
        if is_allowlisted(content, allowlist):
            current_line += 1
            continue
        for name, pattern in patterns:
            if pattern.search(content):
                findings.append(
                    {
                        "kind": "content",
                        "name": name,
                        "path": current_file or "<unknown>",
                        "line": current_line,
                        "preview": redact(content),
                    }
                )
        current_line += 1
    return findings


def path_matches(path: str, patterns: Iterable[re.Pattern[str]]) -> bool:
    return any(pattern.search(path) for pattern in patterns)


def is_allowlisted(value: str, allowlist: Iterable[re.Pattern[str]]) -> bool:
    return any(pattern.search(value) for pattern in allowlist)


def report_findings(stage: str, findings: list[dict]) -> int:
    print(f"Gitflow Guard: {stage}")
    if shutil.which("gitleaks"):
        print("Scanner hint: gitleaks available on PATH")
    if not findings:
        print("PASS: no blocking findings")
        return 0
    print("BLOCK: findings detected")
    for finding in findings:
        location = f"{finding['path']}:{finding['line']}" if finding["line"] else finding["path"]
        print(f"- {finding['name']} at {location}")
        print(f"  {finding['preview']}")
    return 1


def git_stdout(repo: Path, args: list[str]) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "git command failed")
    return result.stdout


def git_optional_stdout(repo: Path, args: list[str]) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=False)
    return result.stdout if result.returncode == 0 else ""


def is_zero_sha(value: str) -> bool:
    return bool(re.fullmatch(r"0{40}", value))


def redact(value: str) -> str:
    if len(value) <= 12:
        return "[redacted]"
    return f"{value[:6]}...[redacted]...{value[-4:]}"


def sh_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


if __name__ == "__main__":
    sys.exit(main())
