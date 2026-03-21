## 1. Immediate Annotation Entry

- [x] 1.1 Trigger create-mode popup directly from a completed valid text selection.
- [x] 1.2 Remove the extra floating annotate button from the normal text-selection path.
- [x] 1.3 Auto-focus the annotation textarea when create mode opens for a new selection.

## 2. Explicit Draft Lifecycle Rules

- [x] 2.1 Persist create-mode draft text in shared selection state while the popup remains open.
- [x] 2.2 Ignore reselection-driven replacement so the active create target stays unchanged until explicit submit or close.
- [x] 2.3 Keep explicit close/cancel as the only non-submit path that discards a create draft.

## 3. Verification And Copy

- [x] 3.1 Add focused tests for popup focus, preserved create context during reselection, and explicit close/submit handling.
- [x] 3.2 Update user-facing copy to describe the direct-selection annotation flow and explicit draft lifecycle.
