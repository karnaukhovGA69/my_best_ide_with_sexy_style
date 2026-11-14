# Documentation in the Secondary Side Bar — #1

Base: `8c5155c82de` (`origin/main`). Scope: the built-in `myself-documents` extension.

The existing View → Documentation Library action opens the catalog in the Secondary Side Bar. Selecting an entry displays it in the reader in the same sidebar without opening an editor tab. The catalog and reader have 30/70 initial weights. The reader retains the rendered article and scroll while the user switches files or collapses the sidebar. The reader includes a Find field because the WebviewView extension API does not expose the editor webview's Find widget.

The container and catalog keep their existing IDs. The workbench stores explicit location customizations and omits default locations, so an uncustomized profile picks up the new sidebar location. The Secondary Side Bar appears opposite the Primary Side Bar, which defaults to the left. Explicit user layout customizations still apply.

Verification: extension host TypeScript check, reader webview TypeScript check, production webview bundling, 51 extension tests and `git diff --check` passed. The new host test checks that expanding the same reader sends no replacement content, and the Chromium test checks search and layout at 270 px. The native app layout still needs a smoke test with the next combined build.

Integration: merge `agent/nerded-issue-1-docs-right` through PR. The existing builtin extension packaging and View menu entry already cover this change.
