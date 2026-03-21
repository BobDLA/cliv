# Gitflow Guard Policy

Use this default stage split unless the repository has a strong reason to differ.

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
