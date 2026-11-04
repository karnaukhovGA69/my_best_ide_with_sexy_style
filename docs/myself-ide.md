# Myself IDE

An experimental Code - OSS distribution. This is the first cleanup stage, not the completed redesign.

## Distribution

- Product identity and user data directory are separate from VS Code and Code - OSS.
- The public app contains no bundled programming-language extensions or Copilot extension. Git, authentication providers, Markdown (including Mermaid and math), themes, terminal, settings, and extension APIs remain.
- `build/lib/distributionExtensions.ts` is the explicit built-in allowlist. It also filters stale build output; adding an upstream extension does not automatically add it to the distribution.
- Open VSX supplies the extension catalog. Installing local VSIX files remains supported. The user's personal language setup is not included in the public app.
- Desktop packaging excludes Copilot SDK runtimes, the Agent Host child entrypoints, and JavaScript/CSS source maps. Source files and development dependencies still contain upstream AI implementation and language packages for incremental removal and optional VSIX builds.
- With `enableTelemetry: false`, built-in telemetry is disabled in both development and packaged runs. The fork also blocks telemetry log appenders, telemetry identifiers, experiments, and automatic crash reporting. Independently installed extensions require their own privacy review.
- Built-in Agent Host startup is blocked when the product has no default chat agent. Changing a user setting cannot restore it.
- Extension auto-updates, recommendations, welcome startup, sticky scroll, snippet suggestions, and format-on-save start disabled. These are defaults, not yet physical removal of their implementation.

## Build

Use the Node version in `.nvmrc` and the pnpm version in `package.json`. After dependencies have been installed using pnpm:

```sh
pnpm run gulp vscode-darwin-arm64
```

The macOS ARM64 app is written to `../Myself-IDE-darwin-arm64/Myself IDE.app`. Other platform builds have not yet been validated. The original baseline build can coexist with this directory.

## Still to implement

- Complete removal of AI workbench modules, Sessions, voice/MCP implementation, and unused dependency trees; the first stage preserves shared service contracts.
- Remaining checklist removals (including command palette/multiple-cursor commands) after dependency checks.
- Bounded local diagnostic logs and the agreed retention policy.
- Own GitHub application registration, repository hub, and opt-in private-repository settings backup. Authentication provider code is retained, but a release-ready identity is not configured yet.
- Documentation library for local Markdown/PDF.
- Terminal engine prototype and personal shell configuration.
- Visual redesign, icon, and final branding across every platform.
- Personal language extension installation and compiler/toolchain setup, kept outside the public distribution.

Preserving source code in this repository does not mean those extensions are included in the installed application. Development checkout size and packaged app size are different measurements.
