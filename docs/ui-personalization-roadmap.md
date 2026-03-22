# UI Personalization Roadmap

## Goal

Define a long-term product direction for cliV's reading and interface personalization without turning the current V1 work into an open-ended settings project.

This roadmap separates:

- a stable long-term direction for reading and interface customization
- the narrow V1 change that is worth implementing now

## Product Direction

cliV is a long-form review tool. Personalization should prioritize review efficiency and reading comfort before expressive theming or low-level rendering controls.

The product line should optimize for:

- faster return to a preferred reading layout
- lower fatigue during long Markdown review sessions
- predictable highlight and annotation visibility
- simple presets before advanced customization

## Scope Principles

### Put in UI settings

- reading and layout preferences
- visual presets for review and highlights
- options that users are likely to change while reviewing documents

### Keep out of V1

- renderer/parser feature flags
- GFM or Mermaid parsing controls
- freeform color editors
- full migration of `~/.cliv/config.toml` into the UI

### Keep in config file for now

- integration and launch behavior
- trusted caller rules
- scan depth
- prompt header overrides and similar advanced agent-facing settings

## Current State

### Already persisted

- theme
- font size
- locale

### Not yet persisted

- sidebar open state
- sidebar tab
- sidebar width
- annotation margin width

### Present but not worth expanding in this effort

- fullscreen
- scroll position restoration

## Phasing

### V1: Reading And Layout Preferences

Goal: ship the highest-value, lowest-risk personalization features with a unified settings entry.

Includes:

- settings entry point in the main UI
- theme, font size, locale in one place
- persisted sidebar open state, tab, and width
- persisted annotation margin width
- Markdown reading settings:
  - content width
  - page padding
  - reading density
- highlight strength presets
- reset to defaults

Explicitly excludes:

- fullscreen redesign or persistence
- scroll position restoration
- parser or renderer toggles
- prompt template editing in the UI
- freeform visual customization

### V2: Preset System

Goal: make cliV feel tailored to different review styles without opening a large configuration surface.

Candidates:

- reading presets such as `comfortable`, `compact`, `focus`
- highlight and annotation presets
- focus mode for stronger active-context emphasis
- code-reading display presets

### V3: Advanced Settings Bridge

Goal: selectively expose a small set of advanced configuration-file-backed options in the app when the value is clear.

Candidates:

- advanced settings section in the UI
- prompt header management
- selective import/export of settings or presets

Non-goal:

- replacing the entire config file with a GUI

## Planned V1 OpenSpec

The current OpenSpec change should only cover V1.

Recommended change boundary:

- reading and layout preferences
- a small set of Markdown reading options
- highlight strength presets
- reset to defaults

V2 and V3 should stay in this roadmap until there is a concrete reason to schedule them.
