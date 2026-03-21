## Why

cliV's selection-based annotation flow currently costs an extra interaction: users select text, wait for a floating action, then click again before they can type. That friction is small per annotation but expensive across dense review passes, and it makes the product feel slower than the underlying task.

The implemented interaction change removes that extra click and supports immediate annotation entry: selection opens the entry popup immediately and focus lands in the textarea. After review, the flow should remain explicit once drafting begins: if users select or copy something else while the create popup is open, cliV should keep the current draft and create target unchanged until the user explicitly submits or closes the popup.

## What Changes

- Open the create-annotation popup immediately after a valid text selection completes.
- Move keyboard focus into the popup textarea as soon as it opens.
- Keep create-mode draft text in shared selection state so the popup can preserve in-progress input while the user interacts elsewhere.
- While the create popup is open, keep the current draft and stored selection unchanged until the user explicitly submits or closes the popup.
- Remove the extra floating annotate button from the normal text-selection path.
- Update UI copy and tests to reflect the direct-selection workflow and explicit-draft lifecycle.

## Capabilities

### New Capabilities
- `annotation-entry-flow`: Turn text selection directly into focused annotation entry, with continuous reselection support for fast review passes.

### Modified Capabilities
- None.

## Impact

- Frontend selection handling in `src/features/annotations/SelectionCatcher.tsx`
- Popup state and submit behavior in `src/features/annotations/AnnotationPopup.tsx`
- Shared selection state in `src/stores/selectionStore.ts`
- Annotation creation helpers and interaction tests in `src/features/annotations/`
- Document composition and user-facing copy in `src/app/components/DocumentArea.tsx`, `src/lib/locales.ts`, and `src/app/demoContent.ts`
