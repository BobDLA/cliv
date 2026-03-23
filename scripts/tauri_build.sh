#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/tauri_build.sh <local|release> [tauri build args...]

Examples:
  scripts/tauri_build.sh local
  scripts/tauri_build.sh local --debug
  scripts/tauri_build.sh release --bundles deb
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-}"

if [[ -z "$MODE" ]]; then
  usage >&2
  exit 2
fi

shift

if [[ "${1:-}" == "--" ]]; then
  shift
fi

TAURI_ARGS=()

case "$MODE" in
  local)
    if [[ "$(uname -s)" == "Linux" ]]; then
      # Local Linux builds only need a deb most of the time.
      TAURI_ARGS+=(--config src-tauri/tauri.local.conf.json)
      echo "Using local Linux Tauri override: src-tauri/tauri.local.conf.json"
    fi
    ;;
  release)
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

cd "$ROOT_DIR"
pnpm exec tauri build "${TAURI_ARGS[@]}" "$@"
