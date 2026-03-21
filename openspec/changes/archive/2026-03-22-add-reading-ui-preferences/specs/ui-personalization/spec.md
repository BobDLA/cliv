# ui-personalization

## Purpose
Define the in-app reading and layout personalization behavior that cliV exposes and persists for long-form review sessions.

## ADDED Requirements

### Requirement: cliV SHALL provide a unified personalization settings entry
cliV SHALL provide a unified in-app settings entry for reading and layout personalization, and that settings surface SHALL expose the V1 reading preferences supported by the application.

#### Scenario: User opens the personalization settings surface
- **WHEN** the user activates the personalization/settings entry from the main application UI
- **THEN** cliV opens a settings surface for reading and layout preferences
- **AND** the user can access existing theme, font size, and locale controls from that surface

### Requirement: cliV SHALL persist V1 reading and layout preferences across launches
cliV SHALL persist the user's V1 reading and layout preferences across launches, including theme, font size, locale, sidebar open state, active sidebar tab, sidebar width, and annotation margin width.

#### Scenario: Persisted preferences are restored on relaunch
- **WHEN** a user changes one or more V1 reading or layout preferences and later reopens cliV on the same machine
- **THEN** cliV restores the saved V1 preferences instead of resetting them to defaults

#### Scenario: Persisted width values are loaded safely
- **WHEN** a previously saved sidebar width or annotation margin width is outside the supported runtime bounds for the current window
- **THEN** cliV clamps that value to the nearest supported bound before rendering the layout

### Requirement: cliV SHALL expose preset-driven Markdown reading presentation controls
cliV SHALL let users adjust supported Markdown reading presentation options from the settings surface using predefined choices rather than arbitrary freeform values.

#### Scenario: User selects a Markdown reading presentation option
- **WHEN** the user selects a supported content width, page padding, or reading density option in personalization settings
- **THEN** cliV applies the selected presentation option to the Markdown reading view
- **AND** the selected option becomes part of the user's persisted V1 personalization preferences

### Requirement: cliV SHALL expose highlight strength presets
cliV SHALL provide predefined highlight strength presets for annotation visibility in the reading interface.

#### Scenario: User changes highlight strength
- **WHEN** the user selects a highlight strength preset in personalization settings
- **THEN** cliV updates annotation highlight visibility according to that preset
- **AND** the selected preset becomes part of the user's persisted V1 personalization preferences

### Requirement: cliV SHALL allow V1 personalization settings to be reset to defaults
cliV SHALL provide a reset action that restores V1 personalization settings to their default values without modifying annotations, sessions, or config-file-backed advanced settings.

#### Scenario: User resets personalization settings
- **WHEN** the user triggers the reset-to-default action for personalization settings
- **THEN** cliV restores all V1 personalization preferences to their default values
- **AND** cliV does not delete annotations, sessions, or values stored in `~/.cliv/config.toml`
