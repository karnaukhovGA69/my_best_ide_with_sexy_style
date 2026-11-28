# Local PDF Preview

Install the VSIX with **Extensions → Install from VSIX…**. In the Files view menu, choose **Open Local PDF Preview…** and select a local `.pdf` file. The preview opens beside the editor. Use **Previous Page** or **Next Page** to render a single page at a time.

The preview supports a subset of PDFs up to 16 MiB and 200 pages. Pages requiring fonts, character maps, or other resources absent from the package show an error. Password-protected PDFs are unsupported. The preview displays page pixels. Text selection, links, interactive forms, annotations, printing, and embedded PDF actions are unavailable.

The extension runs locally. It reads the selected file once and uses a packaged PDF.js worker to render pages without external resources.

The installed extension `myself.myself-local-pdf-viewer` also exports `apiVersion: 1` and `openBytes(bytes: Uint8Array): Promise<boolean>` to extensions in the same extension host. The byte API keeps focus in the editor and returns whether the preview panel accepted the document. It takes PDF bytes from the caller and copies the selected range before opening the panel.

## Offline package build

Requires Node.js with TypeScript stripping, `unzip`, esbuild 0.28.1 and VSCE 4.1.1 already available locally. Pass the official Mozilla `pdfjs-6.5.438-dist.zip` saved to disk. The packager verifies the archive, the extracted modules and license, and the resulting worker against `engine.json`.

```sh
NERDED_PDF_ESBUILD=/path/to/esbuild NERDED_PDF_VSCE=/path/to/vsce \
  node scripts/package.mts /path/to/pdfjs-6.5.438-dist.zip /path/to/local-pdf-preview.vsix
```

The extension source is MIT-licensed. The bundled PDF.js engine is from Mozilla PDF.js 6.5.438 under Apache-2.0. The package includes the engine license and its notices.
