# Myself IDE

An experimental Code - OSS distribution undergoing incremental cleanup. The current changes cover the first five implementation stages; the visual redesign and planned new features are not complete.

## Distribution

- Product identity and user data directory are separate from VS Code and Code - OSS.
- The public app contains no bundled programming-language extensions or Copilot extension. Git, authentication providers, Markdown (including Mermaid and math), themes, terminal, settings, and extension APIs remain.
- `build/lib/distributionExtensions.ts` is the explicit built-in allowlist. It also filters stale build output; adding an upstream extension does not automatically add it to the distribution. Emmet and Grunt/Gulp/Jake integrations are excluded.
- Open VSX supplies the extension catalog. Installing local VSIX files remains supported. The user's personal language setup is not included in the public app. `build/package-grammar-extension.ts` can package an individual standalone declarative grammar as a VSIX; executable language servers need their own build and dependency packaging.
- Desktop and remote-server packaging use `build/lib/distributionRuntime.ts` to exclude standalone Sessions, Agent Host and local transcription output. Production bundling also excludes their entrypoints and resources. The package filters exclude Copilot SDK and its platform runtimes, `@vscode/copilot-api`, `@anthropic-ai/sdk`, and `foundry-local-sdk`. JavaScript/CSS source maps are excluded from the installed app.
- Built-in Agent Host and Sessions launch paths, AI CLI commands, remote Agent Host access, and local transcription are blocked when the product has no default chat agent. The desktop workbench uses the unavailable transcription service. Cloud Sandbox skips GitHub session lookup and rejects network operations in this product configuration. Voice and Sessions action/contribution registrations are gated or removed; shared voice service contracts remain registered for dependency compatibility.
- Shared AI workbench, inline-chat, MCP, service/API code and some transitive dependencies still exist. Source files and development dependencies also retain upstream language packages and AI implementations. These changes do not constitute complete source-tree erasure of AI.

## Editor behavior

- Inline Chat no longer registers its eager editor controller, notebook integration, actions, accessibility views, model-selection contribution or agent-enablement listeners. Its session service rejects creation and its resolver returns no session, preserving dependency contracts without starting local or Agent Host AI sessions. Shared implementation files and terminal/chat dependencies remain for subsequent cleanup.

- The workbench Command Palette provider, its main action and menu entries are removed. File/view quick access and the command execution API remain, so extension commands can still run through their own UI or keybindings. UI that only exposed an extension command through the palette will need another entry point.
- User-facing multiple-cursor actions, column-selection command registrations and mouse gestures are removed. The editor's internal multi-selection/multi-edit machinery remains for operations such as rename, snippets and extension APIs.
- The code editor's Sticky Scroll contribution and its workbench actions are no longer loaded. Shared implementation files may remain in the source tree.
- Built-in format-on-save participants and settings are removed for text editors and notebooks. Manual formatting and extension formatting providers remain. An installed extension can still implement its own save hook independently.
- The extension recommendation engine, notification service and installed-program tips scanner are no longer loaded. Recommended views and actions are removed; compatible empty services preserve extension management and IPC contracts. Manual catalog browsing, VSIX installation and manual updates remain.
- Periodic extension update checks, automatic installation/replacement, and automatic extension restarts are removed, along with their settings and controls. Old settings and per-extension preferences cannot reactivate them. Explicit Check for Updates, Update All, individual updates, manual restarts and VSIX installation remain. Legacy internal auto-update methods return disabled values or do nothing for compatibility. Security and catalog metadata requests are retained; independently installed extensions can implement their own network behavior.
- Welcome startup and snippet suggestions start disabled. Their remaining implementations have not all been physically removed. Snippet support needed by extensions remains available.

## Privacy and diagnostics

With `enableTelemetry: false`, built-in telemetry is disabled in both development and packaged runs. The fork blocks telemetry log appenders, telemetry identifiers, experiments, and automatic crash reporting. Retained standard extension reporters respect the extension telemetry API opt-out. Reporter source code and some in-memory metadata preparation still exist; independently installed extensions can make their own network requests.

The default diagnostic level is Warning, with Error also recorded. Debug/Trace can be enabled explicitly. Native formatted core log channels, including the core Extension Host log, use files of at most 2 MiB plus four backups: **up to 10 MiB per channel, not a global application quota**. They rotate on the first write in a new UTC day, and channel files at least seven days old are removed when that channel initializes or rolls over. There is no separate cleanup timer or background scan.

Retention touches only the channel's exact current/backup filenames and rejects non-regular files. Raw Output, extension-owned channels and explicitly nonrotating channels keep their original retention behavior. Previous session directories retain the upstream cleanup policy, and the browser FileLogger does not use this native retention policy. Individual core messages and the pre-initialization queue are bounded, so exceptionally large messages or bursts can be truncated or lose older buffered entries. Arbitrary diagnostic messages are not universally scrubbed of secrets.

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
- Own GitHub application registration, repository hub, and opt-in private-repository settings backup. Authentication provider code is retained, but a release-ready identity is not configured yet.
- Documentation library for local Markdown/PDF.
- Terminal engine prototype and personal shell configuration.
- Visual redesign, icon, and final branding across every platform.
- Personal Rust/C++/F#/Lua/Go/Docker/YAML/JSON/SQL extension installation and compiler/toolchain setup, kept outside the public distribution.

Preserving source code in this repository does not mean those extensions or standalone workers are included in the installed application. Development checkout size, packaged app size, RAM use and startup performance are separate measurements. Final build and smoke-test results for each stage should be recorded after integration validation.
