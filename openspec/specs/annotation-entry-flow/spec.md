# annotation-entry-flow

## Purpose
TBD: Define how annotation entry opens and remains stable while the user is creating an annotation from a document selection.

## Requirements

### Requirement: Valid text selection SHALL open focused annotation entry immediately
When a user completes a valid text selection in the document viewer, cliV SHALL open the create-annotation popup without requiring a secondary click and SHALL focus the textarea for immediate typing.

#### Scenario: Selection opens create popup directly
- **WHEN** the user selects a non-empty passage in the document viewer and releases the pointer
- **THEN** cliV opens the create-annotation popup anchored to that selection
- **AND** the popup textarea receives focus immediately
- **AND** no floating confirmation button is required before typing

### Requirement: Reselection SHALL NOT replace the active create context implicitly
When the create popup is already open, cliV SHALL keep the current stored selection, draft text, and kind unchanged until the user explicitly submits or closes the popup.

#### Scenario: Non-empty draft stays active during unrelated reselection
- **WHEN** the create popup is open for selection A
- **AND** the draft contains non-whitespace text
- **AND** the user selects or copies selection B while the popup remains open
- **THEN** cliV does not create an annotation for selection A yet
- **AND** cliV keeps the popup anchored to selection A
- **AND** cliV preserves the existing draft text for explicit submit or close

#### Scenario: Empty draft also stays active until explicit close
- **WHEN** the create popup is open for selection A
- **AND** the draft is empty or whitespace-only
- **AND** the user selects or copies selection B while the popup remains open
- **THEN** cliV does not create an annotation for selection A
- **AND** cliV keeps the popup anchored to selection A until the user explicitly submits or closes it

### Requirement: Popup launch SHALL survive focus-driven selection collapse
Focusing the create textarea SHALL NOT clear the stored selection or close the popup before the user submits or explicitly closes it.

#### Scenario: Deferred selectionchange does not clear active create context
- **WHEN** cliV opens the create popup for a valid selection
- **AND** browser focus movement collapses the native text selection afterward
- **THEN** cliV keeps the create popup open for the stored selection
- **AND** the pending create context remains available for submit or reselection handling
