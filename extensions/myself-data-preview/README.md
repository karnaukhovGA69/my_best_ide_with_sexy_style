# Local Data Preview

Open a local `.json` or `.csv` file in the text editor. Select **Open Data Preview** in the editor toolbar or its overflow menu. The panel opens beside the text editor and shows a snapshot of its current buffer, including unsaved changes. Run the action again to refresh the same panel.

JSON opens as an expandable tree. The current Nerded Code runtime preserves the written form of numbers. The preview accepts strict JSON. CSV opens as a table with numeric column headings. All rows are displayed as data, with quoted commas, doubled quotes and multiline fields supported.

The panel uses static HTML and the editor theme. File content appears as text, including markup and cells that begin with a spreadsheet formula. The panel has no scripts, resource roots or network access. It reads the active local editor buffer and leaves it unchanged.

Each input may contain up to 1 MiB of UTF-8. CSV supports up to 200 records and 40 columns per record. JSON supports 32 nested container levels and 2048 values, including containers. The rendered panel can contain up to 512 KiB of HTML. For a file beyond a limit, the editor gives the reason and the text stays available.

## Build and install locally

From the fork with its pinned development dependencies installed:

```sh
pnpm --dir extensions/myself-data-preview run test
cd extensions/myself-data-preview
../../build/node_modules/.bin/vsce package --no-dependencies --allow-missing-repository --out ../../myself-data-preview.vsix
```

Choose **Install from VSIX…** in the Extensions view and select the generated file. The package is optional and works with Nerded Code based on Code OSS 1.146 or newer. Use the normal Extensions view to disable or uninstall it.
