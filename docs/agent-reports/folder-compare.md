# folder-compare — optional folder comparison

## Scope and status

- Task #10, branch `codex/folder-compare`.
- Base `82353c86aeeed59f2f67d18a89648bd9a3b9a87b` from local main. Required baseline commits `99373603913f162e9d1256cc621949b8bdef03c0` and `01293638a16` are ancestors.
- Ownership is only `extensions/myself-folder-compare/**` and this report. No shared entrypoints, dependencies, allowlists, build pipeline, settings, profiles, Git data or existing feature sources changed.
- MVP implemented and author checks passed. Exact implementation commit and independent reviews are handed off separately, then recorded below. Native VSIX installation and UI acceptance remain pending. No complete IDE build, package, window launch or owner-profile installation was performed.

## Existing paths and design decisions

Before implementation, traced native folder dialogs in `extensions/git/src/commands.ts` and `extensions/myself-documents/src/library.ts`, public `vscode.diff` registration in `src/vs/workbench/api/common/extHostApiCommands.ts`, and Git's private `_workbench.openMultiDiffEditor` calls. The task is new behavior, not an existing scanner defect. There was no existing folder scanner to repair.

Architecture approved an optional Explorer `TreeDataProvider`, public `TextDocumentContentProvider` and public `vscode.diff`. No MultiDiff or core contract adaptation is required. Snapshot providers keep comparison bytes separate from live file reopening, unsaved buffers and subsequent path replacement. Node's path-based scan remains non-atomic against concurrent ancestor substitution; Security explicitly accepted documenting this residual boundary instead of adding a native helper. Security approved explicit manual read-only operation in Restricted Mode with roots solely from user pickers and a separate Compare confirmation.

The repository prohibits new JavaScript sources. Production is TypeScript compiled to CommonJS with the existing repository TypeScript compiler. Tests are `.cts` files executed by Node 24. No JavaScript allowlist exception, runtime dependency or new build dependency was added.

## Before and after

Previously this optional package and visible folder comparison flow did not exist. Installing the future VSIX adds **Compare Two Folders…** to Files header overflow and a comparison button in the collapsed **Folder Comparison** Explorer view. Opening menus, activating the extension and requesting tree children only render the current model.

Compare requests exactly two native single-folder selections and a separate modal confirmation showing both roots and limits. It ignores all command arguments and does not choose any workspace root automatically. Cancelling either picker or confirmation does no scanning. A running scan uses cancellable native progress; cancellation discards partial new results. Repeated scans do not overlap and no scan runs automatically.

Results are relative paths, with **Added on Right**, **Removed from Right**, **Changed** or **Skipped**. Empty added/removed directories are included. A file/directory conflict is explicit and does not recurse into its subtree. Complete regular-file bytes are compared, including equal-size/equal-mtime files. Missing sides are inferred only from completed parent enumeration, never from permissions, links, truncation or errors. Limits and errors are visibly incomplete, not equality. Text-preview unavailability for binary/invalid UTF-8 does not erase a known byte difference.

Clicking an eligible row calls public `vscode.diff` with two generated snapshot URIs and a plain-text title. UTF-8 decoding is fatal and NUL-containing binary data has no text preview. Added/removed regular text files use an empty snapshot only for the proven absent side. A private provider performs immutable string lookup only, without filesystem/provider fallback. IDs contain no source path, query or content. Unknown, forged, expired and reloaded snapshot URIs fail explicitly. Commands require the current internal row object and generation; external objects and URI arguments cannot select paths. Labels and tooltips escape controls, bidi controls and icon syntax and never use trusted Markdown.

No comparison action merges, copies, restores, saves, executes files, invokes Git, parses hooks/settings, installs anything or changes selected directories. Old open snapshot contents remain unchanged after a new comparison. Existing editor events may still be observed by other installed extensions; this extension does not guarantee the behavior of third-party extensions.

## Bounds and platform limits

- Both trees share 4,000 enumerated entries, including skipped entries. Result rows are bounded by that count plus one root limit/error summary. Enumeration uses `opendir` with buffer size one, not unbounded `readdir`.
- Root depth is zero. Directories at depth eight are shown as skipped without opening them; regular files at depth eight may be compared. No traversal beyond a shown boundary.
- Per-file cap is 4 MiB. Aggregate actual bytes read across both sides are at most 32 MiB, reduced by retained earlier snapshots. Reads are at most 64 KiB, with one operation at a time. One byte is reserved for actual EOF verification, so a reported file size exactly at a byte boundary is conservatively skipped. Underreported size is not mistaken for complete bytes.
- A 20-second elapsed-time budget and cancellation are checked between operations. They are cooperative bounds, not a hard deadline for kernel/filesystem I/O. The enumeration boundary is conservative if a directory might end exactly when the entry budget is exhausted.
- At most 16 snapshot pairs are retained. Reopening one row reuses its pair; no unbounded duplication. Open previous pairs share the raw-content budget with subsequent scans. Requested snapshots are released upon actual document-close events rather than inferred from document-list absence. A partially failed editor load is conservatively retained until document close or reload. A new comparison invalidates old row commands but does not overwrite open snapshots. Dispose releases providers, rows, commands and maps and requests cancellation.
- Raw bytes are not RSS. Decode strings, IPC and editor models make extra copies, and normal editor model lifetime remains owned by VS Code.
- Only native absolute `file` picker paths without authority/query/fragment are accepted. Remote windows are refused before pickers. Static root/ancestor/leaf symlinks, junctions and special files are skipped. Identical and nested selections are allowed within the same bounds. Mounts and hardlinks are not physical-locality or isolation guarantees.
- POSIX `O_NOFOLLOW` and `O_NONBLOCK` are required. Unsupported platforms, including Windows in this MVP, return an explicit unsupported result rather than silently dropping flags. No native binary is introduced.
- Component checks and canonical paths, fd regular/type/dev/ino checks before reading and version checks afterwards detect common substitutions. Another writer can still replace an ancestor between Node's path-based checks and `opendir`/`open`. A later check cannot undo enumeration/read already performed. Detected unstable content is discarded. No race-proof sandbox or atomic whole-tree snapshot is claimed.

## Files

- `src/comparison.ts` — bounded, read-only native scanner and byte comparison.
- `src/controller.ts` — dialogs, confirmation, passive tree, membership/generation, snapshot lifetime and public diff dispatch.
- `src/extension.ts` — standard extension activation.
- `package.json`, `package.nls*.json`, `l10n/bundle.l10n*.json` — optional contributions and English/Russian strings.
- `tsconfig.json`, `.vscodeignore`, `.gitignore`, `LICENSE.txt`, `README.md` — existing-toolchain compilation, optional packaging exclusions, license and reproducible future local smoke.
- Three `.test.cts` files — scanner fixtures/IO races, controller/API fixtures and metadata/localization checks.

## Author checks

- **55/55 passed**, Node 24.22.1 on macOS ARM64. Tests execute compiled production code. Scanner tests use synthetic IO wrappers and real disposable temporary files. Controller tests use a VS Code API fixture, not a running extension host.
- Contents: identical/nested/same roots, additions/removals/empty files/directories/type conflict, equal length and mtime with changed bytes, binary, links/cycles/ancestor links, shared entry quota including links, depth, file/aggregate byte caps, EACCES, cancel before/during open/read with close assertions, fd identity, regular-to-directory and synthetic FIFO substitutions, nofollow leaf substitution, deterministic ancestor substitution with zero byte reads for that interleaving, directory substitution before enumeration, sibling-prefix canonical escape, chunk/flags/time checks.
- Controller checks include zero passive IO, two pickers plus explicit confirmation, remote/authority/query/fragment/UNC refusal, ignored command args, forged/stale items, strict provider URI lookup, immutable snapshots, old generation retention/close, budget deduction, pair reuse/16-pair cap, binary/invalid UTF-8, control/bidi/icon escaping, scan cancellation/dispose, overlapping commands, error recovery and real source deletion before snapshot diff.
- Metadata checks cover no dependencies/proposed API/install hooks, visible menus, manifest/runtime English and Russian keys/placeholders, and source/test packaging exclusions. This is not an actual VSIX archive audit.
- A new scanner edge case was reproduced before fixing: synthetic zero-size metadata on two differing nonempty files falsely returned equality (one targeted test, exit 1). Actual bounded EOF verification fixes it; regression and conservative exact-byte-boundary refusal are included in the final suite. This was found in this new implementation, not claimed as an inherited product defect.
- A provider lifetime regression was reproduced after the initial checkpoint: delaying the document-list notification until after diff dispatch caused the original pruning logic to expire already-requested snapshots (one targeted test, exit 1). The fix tracks actual provider requests and document-close events, with conservative bounded retention. Final 55 includes that regression. This fixture demonstrates the ordering assumption in the new controller, not proof of a particular native RPC ordering.
- Targeted strict TypeScript compilation of the three production files and existing `vscode.d.ts`: **0 diagnostics**, including the actual repository `node_modules/.bin/tsc` native compiler. The integrator caught `moduleResolution=node10` removal in native TypeScript 7 after an initial successful run with the older JS compiler. The final configuration uses the supported `module=Node16` / `moduleResolution=Node16` pair; without package `type=module`, emitted runtime stays CommonJS. The full 55 tests passed again on the native compiler output. Existing compiler and Node type declarations were used read-only; no dependency installation, symlinks, shared output or compiler change.
- Targeted repository ESLint on the six source/test files: **0 errors, 0 warnings**. Invoked existing ESLint with the repository configuration; no rules disabled.
- `git diff --check` is clean. No full client check/build or package was necessary for this independent optional extension.

Standard verification after repository dependencies exist:

```sh
pnpm --dir extensions/myself-folder-compare test
pnpm run eslint extensions/myself-folder-compare/src extensions/myself-folder-compare/test
```

The author used the pre-existing Node 24 executable and actual repository `.bin/tsc` directly because this isolated worktree has no dependency tree. Equivalent targeted invocation, with environment variables set to existing tool locations (`TSC` is the repository executable, not `typescript/lib/tsc.js`):

```sh
"$TSC" -p extensions/myself-folder-compare --typeRoots "$NODE_TYPES"
"$NODE24" --test extensions/myself-folder-compare/test/*.test.cts
```

## Integration and deferred native acceptance

There is **no core import or i18n.resources registration**. Do not add the package to product allowlists/default extensions. Integrate the source task commit; optional VSIX preparation and installation are a later explicit step. Runtime entry is `out/extension.js`, generated from the committed TypeScript.

For the later isolated local smoke, compile with the existing compiler, use an already available VSCE to run `vsce package --no-dependencies` in the extension directory and inspect archive contents before manually installing into a disposable profile. Do not automatically download a packager or use the owner's profile. The package prepublish script compiles using the repository toolchain.

Native acceptance still needs the actual Files overflow/view button, both picker cancels, confirmation cancel, real additions/removals/equal-metadata differences, permissions/links/depth/entry/byte/time limits, progress cancellation, binary preview refusal, read-only diff panes, previous snapshots across repeated comparisons and close/reload, source file immutability, Restricted Mode, remote refusal and unsupported-platform explanation. Include narrow-window/long-path and Russian-localization checks. Unit/API fixtures do not prove native geometry, readonly editor behavior, document-close timing or VSIX loading.

## Review and commits

Architecture and Security approved the design boundaries before implementation and gave **PASS SOURCE** for exact `ae57bc2f7950708ed1ceef53604b92f2cdaefc18` including the implementation checkpoint. Their reviews did not execute tests, GUI or VSIX. Independent QA of the provider lifetime regression is still pending. Final configuration correction changes only the supported module-resolution pair and report; scanner/controller runtime source is unchanged. No native tests are implied by source approval.

- Implementation checkpoint `a0d0a5f9940ceb166115414ba3a331ed2ad9fb61`. Hold this alone until the incremental provider-lifetime fix is included.
- Provider-lifetime fix `ae57bc2f7950708ed1ceef53604b92f2cdaefc18`. Include the following TypeScript 7 configuration correction as well.
