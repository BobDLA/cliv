# agent-reply-capture Specification

## Purpose

Define how cliV captures current agent replies across supported integration transports while preserving session isolation, reviewable content, safe diagnostics, and external configuration ownership.

## Requirements

### Requirement: Codex reply capture accepts notify and Stop hook input
cliV SHALL preserve the `cliv cache-codex <json>` notify interface and SHALL also accept a Codex `Stop` lifecycle-hook payload from stdin when `cliv cache-codex` is invoked without a JSON argument.

#### Scenario: Existing notify integration captures a reply
- **WHEN** `cliv cache-codex` receives an `agent-turn-complete` JSON argument with a non-empty thread id and assistant message
- **THEN** cliV stores that reply under the originating Codex process identity using the existing cache metadata contract

#### Scenario: Plan mode Stop hook captures a plan
- **WHEN** `cliv cache-codex` receives a Plan-mode `Stop` payload whose assistant-message field is empty but whose transcript contains an `item_completed` Plan for the same session id and turn id
- **THEN** cliV stores that exact Plan item as the current reply for the originating Codex process

#### Scenario: Stop hook captures a directly supplied plan
- **WHEN** a Plan-mode `Stop` payload contains a non-empty last assistant message
- **THEN** cliV stores that message without reading the transcript

#### Scenario: Ordinary Stop hook captures a reply
- **WHEN** a valid `Stop` hook payload has a permission mode other than `plan`
- **THEN** cliV stores its last assistant message through the same cache path

#### Scenario: Invalid or empty input does not replace content
- **WHEN** the cache command receives malformed JSON, an unsupported event, or neither a non-empty assistant message nor an exact same-session same-turn Plan transcript item
- **THEN** cliV does not replace the current reply cache with that input

### Requirement: Current Codex reply replaces an earlier turn
For accepted Codex events, cliV SHALL atomically replace the PID-keyed reply for the originating Codex process while retaining session metadata used for alias resolution.

#### Scenario: Plan follows an ordinary reply in one Codex process
- **WHEN** cliV captures an ordinary reply and then a valid Plan-mode Stop reply from the same Codex process
- **THEN** subsequent reply extraction returns the plan rather than the earlier reply

### Requirement: Plan transport envelope is reviewable Markdown
cliV SHALL remove an exact outer `<proposed_plan>...</proposed_plan>` transport envelope before displaying the enclosed plan, without rewriting ordinary Markdown or embedded examples.

#### Scenario: Wrapped plan is captured
- **WHEN** a Stop message consists of a proposed-plan opening tag, Markdown plan content, and the corresponding closing tag
- **THEN** cliV stores the enclosed Markdown without the outer transport tags

#### Scenario: Non-envelope content is preserved
- **WHEN** a reply does not consist entirely of the proposed-plan envelope
- **THEN** cliV preserves the reply content unchanged

### Requirement: Cache diagnostics do not expose reply payloads
cliV MUST NOT write complete Codex notify or Stop payloads, user prompts, or assistant messages to its diagnostic log while handling cache commands.

#### Scenario: Notify JSON is supplied on the command line
- **WHEN** cliV logs invocation details for `cliv cache-codex <json>`
- **THEN** the log contains only redacted command information and payload length, not the JSON content

### Requirement: Codex hook configuration remains user-owned
cliV SHALL document the notify and Stop-hook configuration required for complete Codex reply capture and SHALL NOT automatically rewrite Codex configuration files.

#### Scenario: User configures Plan Review capture
- **WHEN** a user follows cliV's Codex integration instructions
- **THEN** the instructions retain notify compatibility, add a user-level Stop hook, and require the hook to be reviewed through Codex's hook trust flow
