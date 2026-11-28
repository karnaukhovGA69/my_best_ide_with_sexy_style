# Document character count

The document editor shows **Characters without spaces** in English and **Символы без пробелов** in Russian beside the current counts. The third value is available when a document or recovered draft opens and updates with the other counts after input, paste or deletion, including unsaved edits.

The count uses the same `Intl.Segmenter` grapheme boundaries as the existing character count. A grapheme contributes to the new count when it contains an ECMAScript non-whitespace character. Spaces, tabs, line breaks, non-breaking spaces and thin spaces do not contribute. Segmenting the original text preserves grapheme boundaries across whitespace. An empty document has three zero counts. `Привет мир` has 2 words, 10 characters with spaces and 9 without spaces.

## Changes

Branch `codex/document-character-count` starts at main `b4ca2d593d1e52628baa042c9f2ddd3fea33b25e`. Commit `287b32fc518a1680e249ea92fb4b05d3dd79c076` changes only the existing editor count calculation, status markup, two localization entries and editor webview tests. The existing wrapping status row accommodates all three values. Integration requires no shared registration or dependency changes. Apply the commit to the package source and rerun the editor webview suite after combining the pagination changes.

## Verification

- The updated count scenarios failed on the base source because the third field was absent. After the change, all 13 editor webview tests passed using the actual HTML and compiled webview script in headless Chromium on macOS ARM64. The test host supplies editor snapshots and receives edit messages over the existing fixture.
- The browser covered initial empty and nonempty snapshots, input, clipboard paste, deletion before acknowledgement, draft recovery and choosing the file version. The fixture checked combining marks and an emoji sequence as graphemes and kept two regional indicators separate across a non-breaking space.
- All three Russian status values fit within a 320 × 800 CSS-pixel viewport. The existing general narrow-layout test also passed at 420 × 800.
- The extension and webview TypeScript checks passed with the repository toolchain (TypeScript 7.0.2). ESLint passed for the three changed TypeScript files. `git diff --check` passed.

The signed application's workbench, PDF generation and installation remain part of the combined package check.
