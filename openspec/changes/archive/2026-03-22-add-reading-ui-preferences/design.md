## Context

cliV already persists a small subset of UI preferences in `localStorage`, but the reading experience is still fragmented. Theme, font size, and locale live in `useUIStore`, while sidebar visibility, active sidebar tab, and resizable layout widths are held in local component state. As a result, users doing long review sessions repeatedly rebuild the same workspace every time the app reloads.

The existing frontend already has good building blocks for a focused V1:

- persisted UI state under the `cliv:` `localStorage` prefix
- CSS variables for typography and theme tokens
- a Markdown viewer that is styled through app-owned overrides rather than a locked third-party theme
- top-bar controls that can be consolidated into a dedicated settings entry

There is also an important boundary to preserve. `~/.cliv/config.toml` currently holds launch and prompt-header behavior, which affects integration contracts and agent-facing behavior. That class of settings is more sensitive than reading preferences and should not be mixed into the V1 interface.

## Goals / Non-Goals

**Goals:**

- Provide a single in-app settings surface for V1 reading and layout preferences.
- Persist high-value reading layout state across launches.
- Expose a small, preset-driven set of Markdown presentation controls.
- Expose highlight strength presets for annotation visibility.
- Keep V1 frontend-first and avoid unnecessary Tauri or config-file changes.
- Keep a reset path that restores V1 personalization defaults predictably.

**Non-Goals:**

- Persisting or redesigning fullscreen behavior.
- Restoring document scroll position.
- Exposing GFM, Mermaid, or renderer/parser feature flags.
- Building a freeform theme editor or arbitrary numeric style editor.
- Moving launch rules or prompt-template configuration out of `~/.cliv/config.toml`.

## Decisions

### 1. V1 preferences use one persisted UI state model

V1 personalization should use a single persisted UI-preferences model rather than continuing to split state between `useUIStore`, `App`, `LeftSidebar`, and layout hooks.

Why:

- users experience these values as one preference set
- one store keeps defaults, persistence keys, and reset behavior coherent
- existing persisted theme/font/locale behavior already provides the correct storage boundary

Alternative considered:

- Add a second settings store only for new controls. Rejected because it would preserve the current split and make reset/default handling harder.

### 2. V1 stays preset-driven instead of fully customizable

Markdown presentation and highlight styling should be exposed as predefined options or enums, not freeform value editors.

Why:

- the current viewer styling is already controlled through CSS variables and app-level overrides
- presets are easier to test, document, and keep visually coherent across themes
- freeform editors would expand the change into design-token management and compatibility work

Alternative considered:

- Let users edit exact widths, spacing, or colors. Rejected for V1 because the added flexibility is outweighed by complexity and support cost.

### 3. The main UI gets a dedicated settings entry

Theme, font size, locale, new layout preferences, and reading presets should be discoverable from one settings entry in the main application chrome.

Why:

- the top bar currently scatters preference controls across separate widgets
- a single entry makes room for V1 without expanding the always-visible control strip further
- the same surface can host reset behavior and future preset groups cleanly

Alternative considered:

- Keep adding independent top-bar controls. Rejected because it increases chrome density and does not create a coherent mental model for personalization.

### 4. Advanced config stays outside the V1 settings surface

The V1 settings surface should not edit launch rules, trusted callers, scan depth, or prompt-header overrides.

Why:

- those settings affect integration behavior rather than reading comfort
- they already have a stable file-backed contract in `~/.cliv/config.toml`
- mixing them into V1 would blur the boundary between personalization and system configuration

Alternative considered:

- Add an "Advanced" section immediately. Rejected for V1 because there is no validated scope yet and it would encourage premature migration of config-file features.

### 5. Persisted layout values must load safely

Persisted widths and layout selections should restore the user's preferences, but width-like values must be clamped to supported runtime bounds when loaded.

Why:

- persisted layout values can become invalid when the viewport or chrome size changes
- safe clamping preserves preference intent without breaking the interface on smaller windows

Alternative considered:

- Trust stored values exactly. Rejected because stale widths can produce visibly broken layout on different screens.

## Risks / Trade-offs

- [UI store grows into a catch-all] → Keep V1 limited to reading and layout preferences, and keep advanced integration config elsewhere.
- [Too many visible controls create a cluttered settings panel] → Use presets and grouped sections instead of exposing every token independently.
- [Persisted layout widths become invalid on smaller screens] → Clamp width-like values at restore time and keep clear defaults.
- [Docs and demo copy drift from shipped behavior] → Update product-boundary docs and any user-facing settings copy alongside implementation.
- [Users expect config-file-backed prompt settings in the new panel] → Document the boundary explicitly in the roadmap and keep that bridge as a later-phase decision.

## Migration Plan

- Introduce default values for any new V1 preference keys and keep existing theme/font/locale keys readable.
- On upgrade, missing keys fall back to defaults; no explicit migration step is required.
- If a stored V1 value is invalid or out of range, cliV falls back to the nearest supported value rather than failing load.
- No Tauri-side storage or config-file migration is required for V1.

## Open Questions

- Should the settings entry be implemented as a popover, dialog, or dedicated panel in the first UI iteration?
- Should content width and page padding be exposed as separate controls in V1, or combined into a simpler reading preset if the panel feels too dense during implementation?
