## Why

cliV already exposes some reading preferences, but the experience is fragmented: theme, font size, and locale persist in one place, while important review layout choices such as sidebar state, active sidebar tab, and panel widths reset between sessions. For long AI-reply review, that repeated setup cost is noticeable, and there is no single settings entry that defines the user's preferred reading environment.

This change should establish a focused V1 for reading and layout personalization. It should cover high-value reading preferences and visual presets that improve day-to-day review comfort, while explicitly avoiding low-level renderer switches, config-file migration, and other advanced customization that would expand scope too early.

## What Changes

- Add a unified settings entry for reading and layout preferences in the main UI.
- Persist the user's preferred reading layout, including sidebar open state, active sidebar tab, sidebar width, and annotation margin width.
- Consolidate existing persisted reading preferences such as theme, font size, and locale under the same settings surface.
- Add a small set of Markdown reading options oriented around presentation, including content width, page padding, and reading density.
- Add highlight strength presets for annotation visibility during long review sessions.
- Add a reset-to-default action for V1 personalization settings.
- Explicitly exclude fullscreen persistence, scroll-position restoration, prompt-template editing, parser/renderer feature flags, and freeform theme editing from this change.

## Capabilities

### New Capabilities
- `ui-personalization`: Define the persisted reading and layout preferences that cliV exposes in-app, including presentation settings, layout state, highlight presets, and default reset behavior.

### Modified Capabilities
- None.

## Impact

- Frontend settings entry points and layout controls in `src/app/`
- Persisted UI state in `src/stores/uiStore.ts` and related hooks/components
- Markdown presentation and highlight styling in `src/features/documents/` and `src/styles/globals.css`
- UI copy and tests covering settings behavior
- Planning and product-boundary documentation in `docs/` and `openspec/`
