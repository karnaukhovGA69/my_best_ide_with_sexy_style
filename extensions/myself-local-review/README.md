# Nerded Code Local Review

Local Review keeps review notes and a checklist for the current workspace. Open **Local Review** in the Explorer. To attach a note, select a range in a local workspace file and choose **Add Local Review Note…** from the editor context menu. When the selection is empty, the command uses the current line.

Select a note to open its file. Use its context menu or the inline comment toolbar to edit, resolve, reopen or delete it. If the saved line context has changed, the note stays in the review list and the file opens without selecting the old range. Add checklist items with the **+** button in the view. Select an item to mark it complete or incomplete.

The extension stores data in the workspace’s local extension state. Note text is shown verbatim. Review data stays out of the reviewed files and Git history.

Run `pnpm -C extensions/myself-local-review run test` from the repository root to compile and run the targeted tests. The extension is an optional package. Integration can build a VSIX from the compiled extension and install it from a local file.
