#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEB_DIR="$ROOT_DIR/src-tauri/target/release/bundle/deb"

cd "$ROOT_DIR"

pnpm tauri:build:local

if ! compgen -G "$DEB_DIR/cliv_*_amd64.deb" > /dev/null; then
  echo "No deb package found in: $DEB_DIR" >&2
  exit 1
fi

DEB_FILE="$(ls -t "$DEB_DIR"/cliv_*_amd64.deb | head -n1)"
echo "Installing: $DEB_FILE"
sudo dpkg -i "$DEB_FILE"
