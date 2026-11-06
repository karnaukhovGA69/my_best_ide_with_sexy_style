# Nerded Code

An experimental Code - OSS distribution undergoing incremental cleanup. The latest validated local package is **Nerded Code 0.0.10 Preview**, built from `3dbf0296716432e7d6e3d61196a71865ccb7ad7c` for macOS ARM64. See [the package handoff](agent-reports/nerded-release-package.md) for its checksum, evidence and limitations. Publication, installation and public screenshots belong to the release coordinator; this document does not establish that the release is published. Earlier package records remain available for [0.0.8](agent-reports/release-0.0.8.md) and [local 0.0.9](agent-reports/release-0.0.9-final.md).

The package includes the [source integration after local 0.0.9](agent-reports/integration-after-local-0.0.9.md), local documentation, resource policies, removal of Git autofetch and continued AI cleanup. Native checks with Workspace Trust enabled confirmed that the restricted fixture started no automatic terminal/task. Observed startup, idle and reader scenarios produced no URL/TCP/DNS requests; this is not an OS network sandbox or a guarantee for arbitrary extensions. See [the product plan](project-plan.md) and [agent handoff](project-handoff.md) for unfinished work.

## Calmer Studio package integration

The approved theme, colored vscode-icons, desktop icons and scoped Calmer layout are included. Appearance offers an explicit preset; untouched new profiles receive it after profile services are ready. Existing/shared settings, fonts and color overrides are preserved. Fresh profiles hide minimap, breadcrumbs and the activity rail unless explicitly configured; View exposes the documentation library directly. Classic/Modern remain available. Native checks confirmed the layout, reader beside code and colored Go/JSON/Rust icons without language extensions. Public screenshots remain with the coordinator.

Visible branding is Nerded Code, while `product.userDataFolderName` preserves the previous Myself IDE profile directory. A final-package launch without `--user-data-dir` opened the original profile database, left its settings file byte-identical and did not move or merge profile folders. Portable, appdata and explicit profile overrides retain their precedence.

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

Current source blocks automatic HTTP(S) media in Markdown preview/editor CSP and common Markdown renderers. Release notes use an explicitly opened local document; extension README/changelog use installed files without gallery fallback. Manual external link clicks remain available. These restrictions are not a network sandbox for arbitrary extensions or shell commands. The source now includes a local documentation library with 4,306 entries from Go, Rust, PostgreSQL, Bash and Linux man-pages. It provides a reader beside code, contents, title search, page Find and local HTML/Markdown/TXT import. Imported Markdown renders headings, lists, tables and code through the same offline sanitizer; existing Markdown imports also use formatted reading without rewriting stored files. TXT stays literal. Folder import creates a local set with relative links restricted to that set. It skips symlinks, .git and node_modules; limits are 16 MiB per document, 64 MiB and 5,000 documents per set, 20,000 scanned entries and 32 nested levels. Failed imports roll back copied files before metadata is committed. PDF and a full-library text index are not included. Reader tests cover all five sets without external requests; VSCE file inventory includes every catalog entry and license. The library is included in the local 0.0.10 Preview ZIP: all 4,306 catalog entries were checked by SHA, and the Effective Go reader was verified in the native app beside code. This does not establish native acceptance of every import format or every document.

Settings export/import is implemented, with preview and explicit application through visible Preferences actions, without a server or an account. The transfer filters unsupported/sensitive entries rather than copying secret storage. Export/import, unchanged settings before Apply, applied values and exclusion of a synthetic sensitive setting were checked in the 0.0.10 candidate. Git autofetch, its scheduler and old settings are removed; manual Fetch/Pull/Push remain.

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

The macOS ARM64 app is written to `../Myself-IDE-darwin-arm64/Nerded Code.app`. Other platform builds and live remote-server/SSH workflows need separate validation. The original baseline build can coexist with this directory.

## Still to implement

- Complete removal of unused AI workbench, inline-chat, MCP and shared service implementations, their development dependencies and any remaining runtime dependency trees.
- Remaining checklist removals and alternate entry points needed after removing the Command Palette.
- A hard aggregate quota for live diagnostic logs remains unimplemented. Startup archive retention already uses a best-effort 100 MiB budget, preserving current, recently active and incompletely scanned sessions; see [log-session-budget](agent-reports/log-session-budget.md).
- Deferred: own GitHub login/catalog/root-clone integration and remote environment integration, after user testing. Cloud backup is not planned.
- PDF reading and a full-library text index; HTML/Markdown/TXT reading and folder import are implemented.
- Terminal engine prototype and personal shell configuration.
- Visual acceptance on other platforms and final public screenshots; Calmer Studio, icons and branding are included in the macOS ARM64 candidate.
- Personal Rust/C++/F#/Lua/Go/Docker/YAML/JSON/SQL extension installation and compiler/toolchain setup, kept outside the public distribution.

Preserving source code in this repository does not mean those extensions or standalone workers are included in the installed application. Development checkout size, packaged app size, RAM use and startup performance are separate measurements. Final build and smoke-test results for each stage should be recorded after integration validation.
