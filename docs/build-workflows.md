# Build Workflows

This document is the detailed build reference for contributors and coding agents. Keep `AGENTS.md` short and decision-oriented; put platform-specific build procedures here.

## Choose The Right Path

- Use `pnpm tauri:dev` for normal local development and UI debugging.
- Use `pnpm tauri:build` on Linux when you need a packaged local smoke check and only care about a `.deb`.
- Use `pnpm tauri:build:install-deb` on Linux when you need to install the package on the current machine and validate launch / integration behavior.
- Use `pnpm tauri:build:release -- <tauri args>` when you need release-style packaging, explicit bundle selection, or non-default targets.

## Linux Local Development

For iterative desktop work, prefer the dev runner:

```bash
pnpm install
pnpm tauri:dev
```

Use this for:
- UI debugging
- Tauri command development
- quick manual interaction checks

Avoid packaged builds during normal edit / reload loops unless the issue only reproduces in a packaged app.

## Linux Local Package Smoke

When you need a packaged Linux build for local verification:

```bash
pnpm tauri:build
```

Current behavior:
- On Linux this command loads `src-tauri/tauri.local.conf.json`.
- The local override narrows bundle output to `deb` only.
- Expected artifact: `src-tauri/target/release/bundle/deb/cliv_<version>_amd64.deb`

Use this for:
- verifying package-level launch behavior
- checking packaging regressions without paying for extra Linux bundle formats
- local QA before deciding whether release-parity packaging is necessary

## Linux Install-Level Validation

When you need to install the built package on the local Linux machine:

```bash
pnpm tauri:build:install-deb
```

What it does:
- runs the Linux local package build path
- finds the newest generated `.deb`
- installs it with `sudo dpkg -i`

Use this when the validation depends on:
- desktop launcher integration
- PATH / install location behavior
- packaged runtime behavior after installation

## Release-Parity Packaging

Use the release entrypoint when local optimization would hide relevant behavior:

```bash
pnpm tauri:build:release -- --bundles deb
```

Examples:

```bash
# explicit Linux bundle selection
pnpm tauri:build:release -- --bundles deb

# skip bundling but keep the release-oriented path
pnpm tauri:build:release -- --no-bundle

# macOS target example
pnpm tauri:build:release -- --target aarch64-apple-darwin
```

Use this for:
- reproducing release workflow behavior
- testing non-default Tauri bundle flags
- building platform-specific targets that should not inherit the Linux local override

## CI And Release Notes

- GitHub release automation remains the source of truth for published assets.
- The release workflow already passes explicit Tauri arguments per platform.
- Local Linux optimization should not be used as a substitute for validating release CI changes.

## Related Files

- `package.json`
- `scripts/tauri_build.sh`
- `scripts/build_install_deb.sh`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.local.conf.json`
- `.github/workflows/release.yml`
