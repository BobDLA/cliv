## Context

The previous selection workflow split one annotation into two user actions:

- select text
- click the floating annotate button to open the popup

That design kept the popup launch explicit, but it introduced repeated friction in the main review loop. It also made continuous annotation awkward because the in-progress create draft lived inside `AnnotationPopup`, while reselection is detected outside the popup in selection listeners.

The implemented change already moved the interaction toward direct manipulation. After review, the draft lifecycle should stay explicit once the popup is open: users may be copying or selecting other text for reference, so cliV should not auto-save or auto-discard a create draft until users explicitly submit or close the popup.

## Goals / Non-Goals

**Goals:**

- Remove the extra click from normal text-selection annotation.
- Put focus into the textarea immediately so typing can start without another pointer action.
- Support immediate annotation entry without an extra confirmation click.
- Keep in-progress drafts stable until users explicitly submit or close them.
- Avoid implicit save/discard when users briefly select or copy other text while drafting.

**Non-Goals:**

- Changing paragraph-bubble annotation into a zero-click flow.
- Auto-submitting annotations on blur or outside click.
- Changing edit-mode semantics for existing annotations.
- Reworking annotation kinds, aggregation, or write-back behavior.

## Decisions

### 1. Completed text selection opens create mode directly

`SelectionCatcher` now treats mouse-completed valid selections as the primary trigger for create mode. Instead of showing a follow-up call-to-action, it opens the popup immediately and anchors it to the selected text.

Why:

- The selection itself is already an explicit user intent.
- Removing the intermediate button cuts the most repetitive piece of friction.

Alternative considered:

- Keep the floating button and only refine its focus behavior. Rejected because it preserves the extra click that caused the complaint.

### 2. Create-mode draft state lives in the selection store

The popup textarea content for new annotations is stored in `useSelectionStore` as `draftComment`. Edit mode remains local to `AnnotationPopup`.

Why:

- Reselection is detected by selection listeners, not by the popup.
- Shared state lets the active create draft survive viewer interaction without retargeting or implicit resolution.
- Keeping edit mode local avoids unnecessary widening of unrelated state.

Alternative considered:

- Keep all textarea state local and reach into the popup imperatively. Rejected because it couples selection listeners to component instances and makes race handling brittle.

### 3. Reselection does not replace the active create context

When create mode is already open, cliV keeps the current stored selection, draft text, and kind until the user explicitly submits or closes the popup. Additional text selection inside the viewer may happen because the user is copying or checking another passage, and cliV should not treat that as permission to save, discard, or retarget the in-progress annotation.

Why:

- Users may select other text temporarily while thinking or copying.
- Implicit save or implicit discard during drafting is too surprising for this workflow.
- Explicit submit/close keeps ownership of draft lifecycle with the user.

Alternative considered:

- Auto-save non-empty drafts and discard empty drafts on reselection. Rejected because reselection can be exploratory and should not change annotation state by itself.

### 4. Popup close remains the only non-submit exit from create mode

Create-mode close, Escape, and cancel continue to discard the draft explicitly. Viewer interaction while the popup is open is not treated as close and must not reset the current create context.

Why:

- Users need a clear distinction between “I am done with this draft” and “I am looking at something else for a moment.”
- Explicit close preserves predictable draft ownership.

### 5. Selection-collapse races are guarded inside deferred handlers

Focusing the popup textarea can collapse the browser selection after `selectionchange` has already been queued. The selection listener therefore checks `showPopup` both before scheduling and again inside the deferred callback.

Why:

- Without the second guard, a stale deferred selection handler can clear the stored selection right after the popup opens.
- The interaction must stay stable across browser timing differences.

## Risks / Trade-offs

- [Accidental data loss while drafting] → Keep draft lifecycle explicit; only submit or close may resolve create mode.
- [Selection timing races] → Guard deferred `selectionchange` processing when popup state has already changed.
- [State sprawl] → Only create-mode draft text moved into shared state; edit mode stays local.
- [Behavior drift between help text and UI] → Update locales, demo copy, and tests together with the interaction change.
