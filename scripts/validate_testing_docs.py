#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TESTING_STANDARD_PATH = ROOT / "docs" / "testing-standard.md"
REGRESSION_CASES_PATH = ROOT / "docs" / "regression-cases.md"
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "test.yml"
PACKAGE_JSON_PATH = ROOT / "package.json"

TEST_FILE_SUFFIXES = (
    ".test.ts",
    ".test.tsx",
    ".test.js",
    ".test.jsx",
    ".spec.ts",
    ".spec.tsx",
    ".spec.js",
    ".spec.jsx",
)

VITEST_CI_COMMAND = "pnpm test"
RUST_CI_COMMAND = "cargo test --manifest-path src-tauri/Cargo.toml"
PLAYWRIGHT_CI_COMMAND = "pnpm test:e2e"
DESKTOP_CI_COMMAND = "pnpm test:e2e:desktop"


@dataclass(frozen=True)
class RegressionCase:
    case_id: str
    coverage: str
    evidence_paths: tuple[str, ...]


@dataclass(frozen=True)
class Finding:
    message: str


def main() -> int:
    findings = [
        *validate_required_files(),
        *validate_testing_standard_and_ci(),
        *validate_regression_cases(),
    ]

    if findings:
        print("FAIL: testing docs linkage check found problems")
        for finding in findings:
            print(f"- {finding.message}")
        return 1

    cases = parse_regression_cases(REGRESSION_CASES_PATH.read_text())
    automated_case_count = sum(1 for case in cases if case.coverage == "automated")
    print("PASS: testing docs linkage is consistent")
    print(f"- CI workflow: {WORKFLOW_PATH.relative_to(ROOT)}")
    print(f"- Regression cases checked: {len(cases)}")
    print(f"- Automated regression cases linked to executable evidence: {automated_case_count}")
    return 0


def validate_required_files() -> list[Finding]:
    required_paths = (
        TESTING_STANDARD_PATH,
        REGRESSION_CASES_PATH,
        WORKFLOW_PATH,
        PACKAGE_JSON_PATH,
    )
    return [
        Finding(f"Required file missing: {path.relative_to(ROOT)}")
        for path in required_paths
        if not path.exists()
    ]


def validate_testing_standard_and_ci() -> list[Finding]:
    if not TESTING_STANDARD_PATH.exists() or not WORKFLOW_PATH.exists() or not PACKAGE_JSON_PATH.exists():
        return []

    testing_standard_text = TESTING_STANDARD_PATH.read_text()
    documented_ci_commands = parse_ci_commands(testing_standard_text)
    workflow_commands = parse_workflow_commands(WORKFLOW_PATH.read_text())
    package_scripts = load_package_scripts()

    findings: list[Finding] = []

    if "docs/regression-cases.md" not in testing_standard_text:
        findings.append(
            Finding("docs/testing-standard.md should reference docs/regression-cases.md so the policy and case catalog stay connected")
        )

    for command in documented_ci_commands:
        if not workflow_covers_command(command, workflow_commands):
            findings.append(
                Finding(
                    f"CI command listed in docs/testing-standard.md is not present in .github/workflows/test.yml: {command}"
                )
            )

        if command.startswith("pnpm "):
            script_name = command.removeprefix("pnpm ")
            if script_name not in package_scripts:
                findings.append(
                    Finding(
                        f"CI command listed in docs/testing-standard.md does not exist in package.json scripts: {command}"
                    )
                )

    return findings


def validate_regression_cases() -> list[Finding]:
    if not REGRESSION_CASES_PATH.exists() or not TESTING_STANDARD_PATH.exists() or not WORKFLOW_PATH.exists():
        return []

    documented_ci_commands = set(parse_ci_commands(TESTING_STANDARD_PATH.read_text()))
    workflow_commands = set(parse_workflow_commands(WORKFLOW_PATH.read_text()))
    regression_cases_text = REGRESSION_CASES_PATH.read_text()
    cases = parse_regression_cases(regression_cases_text)

    findings: list[Finding] = []

    for case in cases:
        block = case_blocks(case.case_id, regression_cases_text)

        if case.coverage == "automated" and not case.evidence_paths:
            findings.append(Finding(f"{case.case_id} is marked automated but has no Evidence path"))
            continue

        if case.coverage == "manual" and "**Manual verification:**" not in block:
            findings.append(Finding(f"{case.case_id} is marked manual but has no Manual verification field"))

        if case.coverage == "pending" and "**Reason:**" not in block:
            findings.append(Finding(f"{case.case_id} is marked pending but has no Reason field"))

        for evidence_path in case.evidence_paths:
            absolute_path = ROOT / evidence_path
            if not absolute_path.exists():
                findings.append(Finding(f"{case.case_id} references missing evidence path: {evidence_path}"))
                continue

            if case.coverage == "automated":
                findings.extend(validate_automated_evidence(case.case_id, evidence_path, absolute_path))
                required_ci_command = infer_required_ci_command(evidence_path)
                if required_ci_command is None:
                    findings.append(
                        Finding(
                            f"{case.case_id} uses automated evidence that the validator cannot map to CI coverage yet: {evidence_path}"
                        )
                    )
                    continue
                if required_ci_command not in documented_ci_commands:
                    findings.append(
                        Finding(
                            f"{case.case_id} requires CI command not listed in docs/testing-standard.md: {required_ci_command}"
                        )
                    )
                if not workflow_covers_command(required_ci_command, workflow_commands):
                    findings.append(
                        Finding(
                            f"{case.case_id} requires CI command not present in .github/workflows/test.yml: {required_ci_command}"
                        )
                    )

    return findings


def validate_automated_evidence(case_id: str, evidence_path: str, absolute_path: Path) -> list[Finding]:
    findings: list[Finding] = []

    if absolute_path.suffix in {".ts", ".tsx", ".js", ".jsx"}:
        if not looks_like_test_file(evidence_path):
            findings.append(
                Finding(
                    f"{case_id} marks {evidence_path} as automated evidence, but it does not look like a test file"
                )
            )

    if absolute_path.suffix == ".rs":
        if "#[test]" not in absolute_path.read_text():
            findings.append(
                Finding(
                    f"{case_id} marks {evidence_path} as automated Rust evidence, but the file has no #[test] blocks"
                )
            )

    return findings


def parse_ci_commands(markdown: str) -> tuple[str, ...]:
    lines = markdown.splitlines()
    capture = False
    commands: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped == "CI 当前覆盖：":
            capture = True
            continue
        if not capture:
            continue
        if stripped == "参考文件：":
            break
        if stripped.startswith("- `") and stripped.endswith("`"):
            commands.append(stripped[3:-1])

    return tuple(commands)


def parse_workflow_commands(yaml_text: str) -> tuple[str, ...]:
    commands = [
        match.group(1).strip()
        for match in re.finditer(r"^\s*run:\s*(.+)$", yaml_text, flags=re.MULTILINE)
        if match.group(1).strip() != "|"
    ]
    return tuple(commands)


def workflow_covers_command(command: str, workflow_commands: tuple[str, ...]) -> bool:
    return any(command == workflow_command or command in workflow_command for workflow_command in workflow_commands)


def parse_regression_cases(markdown: str) -> tuple[RegressionCase, ...]:
    blocks = re.split(r"(?=^### )", markdown, flags=re.MULTILINE)
    cases: list[RegressionCase] = []

    for block in blocks:
        if not block.startswith("### "):
            continue
        header_line = block.splitlines()[0]
        case_id = header_line.removeprefix("### ").split(" — ", 1)[0].strip()
        coverage_match = re.search(r"- \*\*Coverage:\*\*\s*(\w+)", block)
        evidence_paths = tuple(re.findall(r"`([^`]+)`", next((line for line in block.splitlines() if "**Evidence:**" in line), "")))
        coverage = coverage_match.group(1).strip().lower() if coverage_match else ""
        cases.append(
            RegressionCase(
                case_id=case_id,
                coverage=coverage,
                evidence_paths=evidence_paths,
            )
        )

    return tuple(cases)


def case_blocks(case_id: str, markdown: str) -> str:
    blocks = re.split(r"(?=^### )", markdown, flags=re.MULTILINE)
    for block in blocks:
        if not block.startswith("### "):
            continue
        header_line = block.splitlines()[0]
        current_case_id = header_line.removeprefix("### ").split(" — ", 1)[0].strip()
        if current_case_id == case_id:
            return block
    return ""


def infer_required_ci_command(evidence_path: str) -> str | None:
    normalized = evidence_path.replace("\\", "/")
    if normalized.endswith(TEST_FILE_SUFFIXES):
        if "/e2e/" in normalized or normalized.startswith("e2e/"):
            return PLAYWRIGHT_CI_COMMAND
        if "/desktop/" in normalized:
            return DESKTOP_CI_COMMAND
        return VITEST_CI_COMMAND
    if normalized.startswith("src-tauri/") and normalized.endswith(".rs"):
        return RUST_CI_COMMAND
    return None


def looks_like_test_file(path: str) -> bool:
    normalized = path.replace("\\", "/")
    return normalized.endswith(TEST_FILE_SUFFIXES) or "/__tests__/" in normalized


def load_package_scripts() -> dict[str, str]:
    package_json = json.loads(PACKAGE_JSON_PATH.read_text())
    scripts = package_json.get("scripts", {})
    return scripts if isinstance(scripts, dict) else {}


if __name__ == "__main__":
    sys.exit(main())
