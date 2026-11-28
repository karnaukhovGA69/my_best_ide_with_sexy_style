# Compare a local VSIX version

The Extensions view menu in a local desktop window includes **Compare Local VSIX Version…**. Choose one regular `.vsix` file up to 32 MiB. The result shows the archive's extension ID, exact version string and SHA-256, along with the active profile and its cached installed version when available. The comparison distinguishes an exact version match, equal SemVer precedence with different version strings, newer, older and unknown.

## Implementation

Branch `codex/local-vsix-version-compare` starts at main `31c44414fd4aa2dd35a020298ad7e61631113429`. Runtime and tests are in `f202c601a5f8daeae6daca46b364ad1774c47c01`. All code changes are under `myselfVsixSets`. The existing desktop import registers both actions. Both reuse the existing shared-process inspector factory and bounded snapshot. The comparison registers after standard desktop extension registration and uses the existing installation diagnostics profile tracker. There is no new IPC, direct extension activation request, gallery call, install operation or live inventory scan in the comparison.

The action ignores command arguments and checks the picker result before accessing the filesystem provider. It sends the observed byte size to the existing inspector, validates the returned metadata and checks the file's size, type and timestamps again after any cache readiness wait. Profile revision, cancellation and provider identity are checked before publishing. The inspector makes and cleans up a private temporary copy. The selected file and extension registries are read-only in this operation.

The installed version comes from a single valid, profile-scoped local user entry in `IExtensionsWorkbenchService.installed`. An empty, failed, unconfirmed, ambiguous or out-of-scope cache yields **Unknown**. The result describes the observed archive bytes and the active profile's cache. It leaves compatibility, signatures and use of shared extension files by other profiles unverified. The native inspector's existing supported-platform and cooperative I/O cancellation limits apply.

Exact version strings include build metadata. A build-only difference retains equal SemVer precedence. The repository SemVer parser and precedence logic are reused. When the first differing prerelease identifiers are both long decimal strings, an exact integer comparison avoids rounding by the bundled comparator.

## Verification

- 52 targeted tests passed on macOS ARM64, including 10 new model and command tests, 33 existing VSIX set tests and 9 installation diagnostics reader tests. The command fixtures use the actual command/menu registry and current profile service and tracker, with a synthetic provider, inspector and cached inventory.
- Checks covered exact build strings, release and prerelease precedence, adjacent numeric prerelease IDs beyond the safe integer range, local menu visibility, picker-only input, file size and type, rejected cache entries, missing cache, cancellation during cache initialization or inspection, failed initialization, provider replacement and final-stat changes.
- Scoped TypeScript 7.0.2 and ESLint with repository rules passed for the changed code and tests. `git diff --check` passed.

The combined package still needs a native menu smoke with the real shared-process transport. The installed version comparison does not supply an install plan. Automated updates and rollbacks still need the shared-store coordination and policy checks in the version planning report.
