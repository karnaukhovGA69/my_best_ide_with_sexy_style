# Myself IDE

An experimental Code - OSS distribution undergoing incremental cleanup. The last recorded published release is [0.0.8-preview](agent-reports/release-0.0.8.md). A [validated local 0.0.9](agent-reports/release-0.0.9-final.md) was built from `9d93537d452`, including document Save As, PDF and settings transfer checks; its GitHub release remains unpublished. The visual redesign and other planned features are not complete. See [the product plan](project-plan.md) and [agent handoff](project-handoff.md).

Further source changes are tracked in [the integration report after local 0.0.9](agent-reports/integration-after-local-0.0.9.md). They include local document resource policies, removal of Git autofetch, Appearance/text-size menus and continued AI cleanup. These changes are absent from the existing ZIP. A new packaged application still needs startup/idle network and untrusted-workspace checks with Workspace Trust enabled. Earlier smoke runs with `--disable-workspace-trust` do not prove those requirements.

## Distribution

- Product identity and user data directory are separate from VS Code and Code - OSS.
- The public app contains no bundled programming-language extensions or Copilot extension. Git, the common authentication API and Microsoft authentication provider, Markdown (including Mermaid and math), themes, terminal, settings, and extension APIs remain.
- Source after 0.0.8 excludes the bundled GitHub integration and GitHub authentication extensions, including stale packaged output. Ordinary Git/git-base and URL/SSH clone remain; GitHub OAuth, publish/catalog/share helpers from these built-ins are no longer supplied. Their source directories remain for now.
- Own GitHub login/catalog/root-clone integration is deferred until user testing. Remote SSH/server integration is also deferred for the first local package; `tunnel-forwarding` is excluded from the current source allowlist, with its sources preserved. Manual terminal Git/SSH remains. Cloud backup is excluded.
- `build/lib/distributionExtensions.ts` is the explicit built-in allowlist. It also filters stale build output; adding an upstream extension does not automatically add it to the distribution. Emmet and Grunt/Gulp/Jake integrations are excluded.
- Open VSX supplies the extension catalog. Installing local VSIX files remains supported. The user's personal language setup is not included in the public app. `build/package-grammar-extension.ts` can package an individual standalone declarative grammar as a VSIX; executable language servers need their own build and dependency packaging.
- Desktop and remote-server packaging use `build/lib/distributionRuntime.ts` to exclude standalone Sessions, Agent Host and local transcription output. Production bundling also excludes their entrypoints and resources. The package filters exclude Copilot SDK and its platform runtimes, `@vscode/copilot-api`, `@anthropic-ai/sdk`, and `foundry-local-sdk`. JavaScript/CSS source maps are excluded from the installed app.
- Built-in Agent Host and Sessions launch paths, AI CLI commands, remote Agent Host access, and local transcription are blocked when the product has no default chat agent. The desktop workbench uses the unavailable transcription service. Cloud Sandbox skips GitHub session lookup and rejects network operations in this product configuration. Voice and Sessions action/contribution registrations are gated or removed; shared voice service contracts remain registered for dependency compatibility.
- Shared AI workbench, inline-chat, MCP, service/API code and some transitive dependencies still exist. Source files and development dependencies also retain upstream language packages and AI implementations. These changes do not constitute complete source-tree erasure of AI.

## Document PDF export

Desktop builds provide **Export Text as PDF** in File and the title toolbar for `.txt` editors. It exports the active editor buffer, including unsaved text, to A4 with 20 mm margins, serif 12 pt text and 1.5 line spacing. A Save Dialog chooses the destination. Text is escaped, preserving line breaks, and rendered locally with the bundled Electron; no TeX or separate Chromium download is required. The output has selectable text and automatic page breaks.

The `myself.documents.exportPdf` command accepts the v1 DTO for the bundled document-editor extension, including validated page options. The separate UI command is `myself.documents.exportActiveTextPdf`. Input is limited to 2 MiB of UTF-8 text; Markdown and HTML are printed literally. The optional document editor provides its own Export PDF button and page-settings UI; the text-editor export action is hidden in custom editors. Generic font selection does not guarantee glyph coverage for every script.

## Editor behavior

- Terminal Chat no longer registers a controller, commands, accessibility views or agent-enablement listeners. Its compatible services keep no AI terminal/session mappings, output sources or automatic approval state, and cannot resolve an AI session. Ordinary terminal processes, shell integration and Tasks remain. Startup initializes task pattern/matcher registries even when no extension contributes to them, so a language-free installation can run tasks. Shared chat tools and MCP code still require cleanup.

- Inline Chat no longer registers its eager editor controller, notebook integration, actions, accessibility views, model-selection contribution or agent-enablement listeners. Its session service rejects creation and its resolver returns no session, preserving dependency contracts without starting local or Agent Host AI sessions. Shared implementation files and terminal/chat dependencies remain for subsequent cleanup.

- The workbench Command Palette provider, its main action and menu entries are removed. File/view quick access and the command execution API remain, so extension commands can still run through their own UI or keybindings. UI that only exposed an extension command through the palette will need another entry point.
- User-facing multiple-cursor actions, column-selection command registrations and mouse gestures are removed. The editor's internal multi-selection/multi-edit machinery remains for operations such as rename, snippets and extension APIs.
- The code editor's Sticky Scroll contribution and its workbench actions are no longer loaded. Shared implementation files may remain in the source tree.
- Built-in format-on-save participants and settings are removed for text editors and notebooks. Manual formatting and extension formatting providers remain. An installed extension can still implement its own save hook independently.
- The extension recommendation engine, notification service and installed-program tips scanner are no longer loaded. Recommended views and actions are removed; compatible empty services preserve extension management and IPC contracts. Manual catalog browsing, VSIX installation and manual updates remain.
- Periodic extension update checks, automatic installation/replacement, and automatic extension restarts are removed, along with their settings and controls. Old settings and per-extension preferences cannot reactivate them. Explicit Check for Updates, Update All, individual updates, manual restarts and VSIX installation remain. Legacy internal auto-update methods return disabled values or do nothing for compatibility. Explicit catalog and security metadata operations remain; independently installed extensions can implement their own network behavior.
- Welcome/walkthrough UI registration and restoration are removed; startup can still open a requested local README or terminal. Snippet suggestions start disabled. Their remaining implementations have not all been physically removed. Snippet support needed by extensions remains available.

## Integrated document and AI cleanup batch

The optional `myself-documents` built-in adds New Document and Open as Document actions for plain `.txt` files. Its webview uses the host document API for edits, save and undo/redo, offers search and A4 typography/margin controls, and exports the latest buffer through the existing local PDF backend. Text remains plain UTF-8. The page preview is approximate; the exported PDF performs pagination.

MCP discovery, gallery initialization, workbench inventory, extension-host MCP registration/transport, gateway/broker, resource filesystem, sampling/logging, elicitation, development mode, Copilot configuration mirroring, editor language features, context UI, migration and CLI addition paths are disabled or removed. Terminal AI tool registrations and voice transport, dictation, playback, dispatch, keyword activation and session controller paths are disabled. Compatible empty services or explicit unavailable errors remain where other code still imports their contracts. Shared AI/MCP implementations are not all removed.

## Local resources and settings

Current source blocks automatic HTTP(S) media in Markdown preview/editor CSP and common Markdown renderers. Release notes use an explicitly opened local document; extension README/changelog use installed files without gallery fallback. Manual external link clicks remain available. These restrictions are not a network sandbox for arbitrary extensions or shell commands. Local documentation library work is in progress and is not yet claimed as shipped.

Settings export/import is implemented, with preview and explicit application through visible Preferences actions, without a server or an account. The transfer filters unsupported/sensitive entries rather than copying secret storage. Export/import and unchanged settings before Apply were checked in the isolated local 0.0.9 profile. Git autofetch has been removed from subsequent source, including its scheduler and old settings; manual Fetch/Pull/Push remain.

## Privacy and diagnostics

With `enableTelemetry: false`, built-in telemetry is disabled in both development and packaged runs. The fork blocks telemetry log appenders, telemetry identifiers, experiments, and automatic crash reporting. Retained standard extension reporters respect the extension telemetry API opt-out. Reporter source code and some in-memory metadata preparation still exist; independently installed extensions can make their own network requests.

The default diagnostic level is Warning, with Error also recorded. Debug/Trace can be enabled explicitly. Native formatted core log channels, including the core Extension Host log, use files of at most 2 MiB plus four backups: **up to 10 MiB per channel, not a global application quota**. They rotate on the first write in a new UTC day, and channel files at least seven days old are removed when that channel initializes or rolls over. There is no separate cleanup timer or background scan.

Retention touches only the channel's exact current/backup filenames and rejects non-regular files. Raw Output, extension-owned channels and explicitly nonrotating channels keep their original retention behavior. In source after 0.0.8, old diagnostic session directories also have a best-effort 100 MiB budget, seven-day retention and at most nine old sessions. Current, recent (24-hour), future-dated, symlinked or incompletely scanned sessions are protected; this is not a hard quota or an atomic lock against concurrent writers. The browser FileLogger does not use this native retention policy. Individual core messages and the pre-initialization queue are bounded, so exceptionally large messages or bursts can be truncated or lose older buffered entries. Arbitrary diagnostic messages are not universally scrubbed of secrets.

## Build

Use the Node version in `.nvmrc` and the pnpm version in `package.json`. After dependencies have been installed using pnpm:

```sh
pnpm run gulp vscode-darwin-arm64
```

macOS packaging removes native debug maps containing the local build/home paths using Apple’s `strip -S`, then scans the package again, including ASAR bytes. Packaging fails if those paths remain in runtime strings, source text or other files. Code signing must run after this step. If deep signing changes native binaries, run `refreshDarwinAsarMetadata(appDirectory)` from `build/lib/distributionPrivacy.ts`, then sign the outer application again without `--deep` and verify the signature. The metadata refresh updates unpacked file sizes and any SHA-256 integrity records while preserving packed payloads. This check covers the configured build paths, not every possible secret or third-party build identity. Use a GitHub noreply identity for published commits.

The macOS ARM64 app is written to `../Myself-IDE-darwin-arm64/Myself IDE.app`. Other platform builds and live remote-server/SSH workflows need separate validation. The original baseline build can coexist with this directory.

## Still to implement

- Complete removal of unused AI workbench, inline-chat, MCP and shared service implementations, their development dependencies and any remaining runtime dependency trees.
- Remaining checklist removals and alternate entry points needed after removing the Command Palette.
- An aggregate diagnostic-log quota and retention across previous sessions, with explicit ownership boundaries for third-party logs.
- Deferred: own GitHub login/catalog/root-clone integration and remote environment integration, after user testing. Cloud backup is not planned.
- Documentation library for local Markdown/PDF.
- Terminal engine prototype and personal shell configuration.
- Visual redesign, icon, and final branding across every platform.
- Personal Rust/C++/F#/Lua/Go/Docker/YAML/JSON/SQL extension installation and compiler/toolchain setup, kept outside the public distribution.

Preserving source code in this repository does not mean those extensions or standalone workers are included in the installed application. Development checkout size, packaged app size, RAM use and startup performance are separate measurements. Final build and smoke-test results for each stage should be recorded after integration validation.
