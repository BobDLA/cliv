## 1. Preference State And Persistence

- [x] 1.1 Expand the persisted UI preference model to cover V1 reading and layout settings, including safe defaults and restore-time clamping for width-like values.
- [x] 1.2 Move sidebar open state, active sidebar tab, sidebar width, and annotation margin width onto the persisted preference path.
- [x] 1.3 Add a reset-to-defaults action that restores only V1 personalization settings.

## 2. Settings Surface And Presentation Controls

- [x] 2.1 Add a unified settings entry in the main UI and consolidate theme, font size, and locale controls into that surface.
- [x] 2.2 Add preset-driven Markdown reading controls for content width, page padding, and reading density.
- [x] 2.3 Add highlight strength presets and wire them to the annotation/highlight presentation layer.
- [x] 2.4 Keep fullscreen behavior, scroll-position restoration, and config-file-backed advanced settings out of the V1 settings surface.

## 3. Verification And Documentation

- [x] 3.1 Add or update automated tests for persisted preferences, reset behavior, and V1 presentation presets.
- [x] 3.2 Update relevant user-facing copy and any demo or help content affected by the new settings surface.
- [x] 3.3 Validate the changed reading and layout flows manually where automation is not yet practical, and record the verification notes.

## Validation Notes

### Automated

- `pnpm test -- src/app/__tests__/App.test.tsx`
- `pnpm typecheck`

### Manual

- Launched `pnpm dev --host 127.0.0.1 --port 4173` in the worktree and opened the app with Playwright CLI.
- Opened the top-bar settings entry and confirmed the unified Reading Settings dialog rendered theme, font size, locale, layout, and reading preset controls in one surface.
- Switched content width to `Narrow`, page padding to `Airy`, reading density to `Relaxed`, highlight strength to `Strong`, and sidebar to `Closed`, then confirmed the page snapshot changed to `Expand sidebar` with the left sidebar removed.
- Clicked `Reset` and confirmed the page snapshot returned to `Collapse sidebar` with the left sidebar present again.
- Captured a local full-page screenshot during validation and left the transient Playwright artifacts out of the repository.
