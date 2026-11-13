# Keyboard Undo and Redo in the document editor

Issue [#11](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/issues/11), native acceptance of [#8](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/pull/8). Base: `25c744fa643`. Scope: `extensions/myself-documents/webview/editor.ts` and its webview regression tests.

The signed macOS ARM64 candidate showed **Draft Needs Review** when Cmd+Z followed an acknowledged list edit. The Undo and Redo buttons worked. The document editor listened for Cmd/Ctrl+Z/Y on the webview window and posted its own Undo or Redo action. The webview shell also forwarded that keydown to the workbench, including when the editor called `preventDefault()`. The workbench's active custom editor handler uses the same TextDocument history. The extra dispatch can change the document version before the editor's message reaches the host. The duplicate dispatch path also exists in the source of preview `3dbf0296716`, before list numbering.

The textarea now consumes its Undo and Redo shortcuts before they reach the shell's bubbling window listener. This retains the existing edit acknowledgement before keyboard history actions. Buttons and the browser's separate `beforeinput` history path continue to use the same request queue.

The Chromium regression simulates the webview shell listener and verifies that Cmd+Z and Cmd+Shift+Z each send one history action, restore the corresponding list state and leave the conflict panel hidden. It failed before the fix because the first key also reached the shell. All 53 extension tests passed after the fix with `pnpm --dir extensions/myself-documents test`. Native recheck on the macOS ARM64 integration candidate is pending.
