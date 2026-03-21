# launch-context-target-resolution

## Purpose
TBD: Define how cliV resolves review content, write targets, trusted callers, and user-configured prompt overrides during launch.

## Requirements

### Requirement: Standalone file launches SHALL be review-only by default
When cliV is launched without an explicit write-target flag and without a trusted caller match, a positional markdown-like file path SHALL be treated as the review document and SHALL NOT automatically enable file write-back.

#### Scenario: Standalone default-reader launch
- **WHEN** cliV is launched as `cliv notes.md` and the launch context does not match any trusted caller
- **THEN** cliV loads `notes.md` as the review content
- **AND** cliV does not set a write target for the session

#### Scenario: Review-only launch falls back to clipboard
- **WHEN** a user submits aggregated feedback from a review-only launch
- **THEN** cliV copies the output to the clipboard instead of overwriting the reviewed file

### Requirement: Explicit target flags SHALL override positional-path interpretation
cliV SHALL accept `--target <file>`, `-t <file>`, and `--compose <file>` as explicit write-target flags. When any of these flags are present, the flagged path SHALL become the write target regardless of trusted-caller detection.

#### Scenario: Explicit target with separate review document
- **WHEN** cliV is launched as `cliv --target draft.md source.md`
- **THEN** cliV treats `source.md` as the review document
- **AND** cliV treats `draft.md` as the write target

#### Scenario: Compatibility alias remains supported
- **WHEN** cliV is launched as `cliv --compose draft.md`
- **THEN** cliV treats `draft.md` as the write target
- **AND** cliV preserves existing write-back behavior for callers using the compatibility alias

### Requirement: Trusted caller launches SHALL support positional target fallback only for the first trusted non-wrapper caller
When cliV is launched without an explicit write-target flag, cliV SHALL canonicalize process names, skip configured wrapper callers, and inspect only the first non-wrapper caller. A single positional file path SHALL be treated as the write target only when that caller exactly matches a configured trusted caller.

#### Scenario: Trusted editor callback with positional target
- **WHEN** cliV is launched by a trusted first non-wrapper caller and receives one positional file path
- **THEN** cliV treats that path as the write target
- **AND** cliV does not replace the review content with the target file when agent reply content is available

#### Scenario: Untrusted first non-wrapper caller does not trigger target fallback
- **WHEN** cliV is launched and the first non-wrapper caller does not exactly match any configured trusted caller
- **THEN** cliV leaves the positional file path in review mode
- **AND** cliV keeps direct file write-back disabled

#### Scenario: Trusted caller matching uses canonical exact names
- **WHEN** the first non-wrapper caller resolves to the canonical name `claude`, `codex`, or another configured trusted caller name
- **THEN** cliV matches only the exact canonical name
- **AND** cliV does not trust callers whose names merely contain the trusted name as a substring

### Requirement: User config SHALL control trusted-caller and prompt-template overrides
cliV SHALL load optional user configuration from `~/.cliv/config.toml` and use it to customize trusted caller matching and prompt header templates.

#### Scenario: Config adds a trusted caller name
- **WHEN** the config file lists a caller name that appears in the parent-process chain
- **THEN** cliV uses that caller match when deciding whether positional target fallback is allowed

#### Scenario: Config overrides prompt headers
- **WHEN** the config file defines custom reply or iterate prompt header text for a supported locale
- **THEN** cliV uses the configured header text instead of the built-in default in generated prompt output
