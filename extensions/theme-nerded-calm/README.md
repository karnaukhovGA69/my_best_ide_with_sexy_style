# Calmer Studio

The Nerded Code dark preset: a neutral editor, quiet chrome, pastel syntax
and the complete colorful vscode-icons 13.0.0 resource set.

Choose **Calmer Studio** in the color theme menu and **Calmer Studio File
Icons (vscode-icons)** in the file icon theme menu. These contributions do
not change settings automatically. High contrast, light themes and personal
color overrides remain available through the standard theme service.

This extension supplies colors and file icons. Workbench layout, initial
profile defaults and the visible preset action are integrated separately.
It contains no activation code, remote resources or downloaded fonts.

## Integration

- Built-in extension ID: `myself.theme-nerded-calm`.
- Color theme setting: `workbench.colorTheme: "Nerded Calm"`.
- File icon theme setting: `workbench.iconTheme: "nerded-calm-file-icons"`.
- Include this directory in the product's built-in extension allowlist.
- Preserve `LICENSE.txt`, `THIRD_PARTY_NOTICES.txt` and `licenses/` in packaging.
- Apply defaults only to the agreed new-profile preset. Existing profiles
  require the visible, explicit apply action; do not rewrite user choices.

The preset does not set fonts, font sizes, language configuration or editor
behavior. File icons remain colorful: do not use a monochrome mask renderer
or `usesCurrentColor` for this icon theme.

## Resource verification

From the repository root, run:

```sh
node --test extensions/theme-nerded-calm/test/resources.test.ts
node extensions/theme-nerded-calm/test/runBrowserTests.ts
```

The browser suite in `test/theme.test.ts` exercises the actual workbench
color and icon loaders, including user overrides and folder/light variants.
Native workbench screenshots and profile/layout checks belong to the shared
integration package; this resource extension alone is not the finished UI.

Source, attribution, license distinctions and asset hashes are recorded in
`THIRD_PARTY_NOTICES.txt` and `fileicons/provenance.json`. This is a pinned
resource snapshot, not an automatically updating upstream extension.
