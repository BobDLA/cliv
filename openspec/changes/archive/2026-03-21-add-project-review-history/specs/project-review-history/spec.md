## ADDED Requirements

### Requirement: Submitted reviews SHALL create project-grouped archive snapshots
cliV SHALL create a new immutable archive snapshot for each successful feedback submission and SHALL store that snapshot under a workspace-specific archive group.

#### Scenario: Submit with direct file write creates an archive
- **WHEN** a user submits feedback and cliV successfully writes the generated content to the current write target
- **THEN** cliV creates a new archive directory under `~/.cliv/history/archive/` for the current workspace group
- **AND** the archive includes `meta.json`, `reply.md`, `annotations.json`, and `submission.json`
- **AND** `reply.md` stores the reviewed reply snapshot used for that submission

#### Scenario: Submit with clipboard fallback still creates an archive
- **WHEN** a user submits feedback in review-only mode, or file write falls back to clipboard, and the clipboard copy succeeds
- **THEN** cliV creates a new archive directory under `~/.cliv/history/archive/` for the current workspace group
- **AND** `submission.json` records that the submission method was clipboard

#### Scenario: Failed submit does not create a partial archive
- **WHEN** a submission fails because cliV can neither write the target file nor copy the content to the clipboard
- **THEN** cliV does not create a partially populated history entry

### Requirement: Workspace grouping SHALL use the normalized startup working directory
cliV SHALL use the normalized current working directory observed at launch as `workspace.path` for review history grouping.

#### Scenario: Archive stores workspace path from launch context
- **WHEN** cliV is launched from working directory `X` and the user later submits feedback
- **THEN** the resulting archive stores normalized `X` as `workspace.path`
- **AND** archives created from the same normalized path belong to the same workspace group

#### Scenario: History grouping does not depend on a database or repo-root inference
- **WHEN** cliV groups archived reviews for display
- **THEN** it uses stored `workspace.path` data from archive files
- **AND** it does not require a local database or repository-root inference to determine the workspace group

### Requirement: History lists SHALL show concise per-entry summaries inside workspace groups
cliV SHALL present archived reviews inside workspace groups and SHALL summarize each entry with coarse submission metadata suitable for quick scanning.

#### Scenario: History entry shows time, submitted characters, and item count
- **WHEN** cliV displays an archived review entry in the History pane
- **THEN** the entry shows the submission time
- **AND** the entry shows the submitted character count
- **AND** the entry shows a coarse count of feedback items as `X条`

#### Scenario: Primary archive summary does not rely on snapshot filenames
- **WHEN** multiple archived reviews contain the same snapshot filename such as `reply.md`
- **THEN** cliV still distinguishes entries using workspace grouping and per-entry summary metadata
- **AND** it does not require the raw snapshot filename to be the primary label

### Requirement: History browsing SHALL support search across archived review content
cliV SHALL allow users to search archived reviews without leaving the History pane.

#### Scenario: Search matches project and source metadata
- **WHEN** a user searches archived history
- **THEN** cliV matches entries by workspace path and stored source file paths from archive metadata

#### Scenario: Search matches archived feedback content
- **WHEN** a user searches archived history
- **THEN** cliV matches entries by archived annotation quotes and annotation comments
- **AND** matching results remain associated with their workspace groups

### Requirement: Opening an archive SHALL restore a read-only review replay
cliV SHALL restore archived review snapshots as a read-only replay of the original review scene.

#### Scenario: Opening an archive restores reply content and annotations
- **WHEN** a user opens an archived review from History
- **THEN** cliV loads the archived `reply.md` as the review content
- **AND** cliV restores annotation highlights and comment cards from `annotations.json`
- **AND** the user sees the archived review in read-only mode

#### Scenario: Browsing an archive does not mutate archived files
- **WHEN** a user scrolls, searches, or inspects an archived review
- **THEN** cliV does not modify the archive's stored `reply.md`, `annotations.json`, or `submission.json`

### Requirement: Archive persistence SHALL remain filesystem-based and self-describing
cliV SHALL persist review history using directory structures and self-describing files under the user's local data directory.

#### Scenario: History data is stored as files instead of a database
- **WHEN** cliV writes or reads review history
- **THEN** it uses directories plus JSON/Markdown snapshot files under `~/.cliv/history/archive/`
- **AND** it does not require a dedicated local database to list or open archives
