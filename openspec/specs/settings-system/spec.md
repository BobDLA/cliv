# settings-system

## Purpose
Define how cliV organizes, persists, and surfaces its own durable settings, including prompt settings, shortcut commands, and the boundary between cliV-managed configuration and external agent integration files.

## Requirements

### Requirement: cliV SHALL use a single config-file boundary for cliV-owned durable settings
cliV SHALL persist supported cliV-owned durable settings in `~/.cliv/config.toml` instead of treating frontend `localStorage` and backend config as separate long-term sources of truth.

#### Scenario: Supported settings persist from a single cliV-owned config file
- **WHEN** the user changes a supported cliV-owned durable setting and later relaunches cliV on the same machine
- **THEN** cliV restores that setting from `~/.cliv/config.toml`
- **AND** cliV does not require the user to understand multiple independent cliV settings stores

#### Scenario: Existing persisted preferences survive the unified-settings upgrade
- **WHEN** a user upgrades from a version where some supported cliV settings existed only in `localStorage`
- **THEN** cliV preserves the effective values of those supported settings through a compatibility or migration path
- **AND** cliV does not silently reset them to defaults during the transition to the unified config model

### Requirement: cliV SHALL expose prompt settings as first-class settings
cliV SHALL treat prompt settings as a first-class part of the settings experience, and supported prompt-setting changes SHALL affect generated reply and iterate prompt output.

#### Scenario: User edits prompt header settings
- **WHEN** the user edits a supported prompt header setting for reply or iterate mode in settings
- **THEN** cliV persists that change in `~/.cliv/config.toml`
- **AND** subsequent generated prompt output uses the updated configured value

#### Scenario: User restores default prompt settings
- **WHEN** the user resets supported prompt settings to defaults
- **THEN** cliV restores the built-in default prompt-header behavior
- **AND** cliV does not delete unrelated reading preferences, sessions, or annotations

### Requirement: cliV SHALL support config-backed shortcut commands
cliV SHALL allow supported shortcut commands to be configured through its settings model, including both application-level commands and the explicitly supported annotation-submit command.

#### Scenario: User customizes a supported shortcut command
- **WHEN** the user changes a supported shortcut command such as open-file, search, submit-return, submit-annotation, add-annotation, or font controls
- **THEN** cliV persists that shortcut mapping in `~/.cliv/config.toml`
- **AND** the updated shortcut triggers the corresponding command on subsequent use

#### Scenario: Invalid shortcut config falls back safely
- **WHEN** cliV encounters an invalid or unsupported shortcut value in its config
- **THEN** cliV ignores that invalid value for runtime dispatch
- **AND** cliV falls back to the built-in default shortcut behavior for the affected command

#### Scenario: Focused annotation submit takes precedence over return submit on the same key
- **WHEN** `submit_annotation` and `submit_return` are configured to the same key combination
- **AND** the user triggers that combination while the annotation popup is in an active submit context
- **THEN** cliV executes `submit_annotation`
- **AND** cliV does not also execute `submit_return`

#### Scenario: Shared submit key falls through to return submit outside annotation editing
- **WHEN** `submit_annotation` and `submit_return` are configured to the same key combination
- **AND** the annotation popup is not in an active submit context
- **THEN** cliV may execute `submit_return` for the same key combination

### Requirement: cliV SHALL distinguish cliV-managed settings from external agent integration config
cliV SHALL clearly distinguish between settings owned by cliV and hook or integration config owned by external agent tools.

#### Scenario: Settings surface shows integration status without taking ownership
- **WHEN** the settings UI surfaces Codex, Claude, or Gemini integration information
- **THEN** cliV explains or indicates that those hook files remain owned by the external agent tools
- **AND** cliV does not treat those files as part of its own writable settings model by default

#### Scenario: Editing cliV settings does not rewrite agent hook files
- **WHEN** the user changes a cliV-owned setting such as a prompt header, reading preference, or shortcut command
- **THEN** cliV updates only its own settings persistence boundary
- **AND** cliV does not silently modify `~/.codex/config.toml`, `~/.claude/settings.json`, or `~/.gemini/settings.json`

### Requirement: cliV SHALL preserve launch-policy settings within the same config model
cliV SHALL keep launch-policy settings such as `scan_depth`, `trusted_callers`, and `ignored_callers` in the cliV config model even when the settings UI exposes them selectively or read-only.

#### Scenario: cliV config contains launch, prompt, UI, and shortcut settings together
- **WHEN** cliV persists its supported durable settings
- **THEN** `~/.cliv/config.toml` can contain `launch`, `prompts`, `ui`, and `ui.shortcuts` settings together as one cliV-owned config model
- **AND** cliV preserves supported launch-policy values while reading and writing other settings groups

#### Scenario: Settings UI omits a launch editor without dropping launch config
- **WHEN** a settings UI revision does not provide direct editing controls for every launch-policy field
- **THEN** cliV still preserves existing supported launch-policy values in `~/.cliv/config.toml`
- **AND** the absence of a direct control does not cause those values to be discarded
