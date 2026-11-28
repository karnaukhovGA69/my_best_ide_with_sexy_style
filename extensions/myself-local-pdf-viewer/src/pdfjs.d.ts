/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// The offline packager resolves these aliases to the two pinned PDF.js release modules.
declare module 'pdfjs-display' {
	export const AnnotationMode: { readonly DISABLE: number };
	export const VerbosityLevel: { readonly ERRORS: number };

	export class PDFWorker {
		static create(options: { port: MessagePort }): PDFWorker;
		destroy(): void;
	}

	interface CanvasSurface {
		canvas: OffscreenCanvas | null;
		context: OffscreenCanvasRenderingContext2D | null;
	}

	interface CanvasFactory {
		create(width: number, height: number): CanvasSurface;
		getNoAlphaContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D | null;
		reset(surface: CanvasSurface, width: number, height: number): void;
		destroy(surface: CanvasSurface): void;
	}

	interface DocumentOptions {
		data: Uint8Array<ArrayBuffer>;
		verbosity: number;
		worker: PDFWorker;
		CanvasFactory: new () => CanvasFactory;
		FilterFactory: new () => { destroy(): void };
		BinaryDataFactory: new () => { fetch(): never };
		enableXfa: boolean;
		enableHWA: boolean;
		enableWebGPU: boolean;
		disableWorkerRendering: boolean;
		useWasm: boolean;
		useSystemFonts: boolean;
		disableFontFace: boolean;
		useWorkerFetch: boolean;
		disableAutoFetch: boolean;
		disableStream: boolean;
		disableRange: boolean;
		isOffscreenCanvasSupported: boolean;
		isImageDecoderSupported: boolean;
		maxImageSize: number;
		canvasMaxAreaInBytes: number;
		stopAtErrors: boolean;
	}

	interface PageViewport {
		width: number;
		height: number;
	}

	interface PDFPage {
		getViewport(options: { scale: number }): PageViewport;
		render(options: { canvas: OffscreenCanvas; viewport: PageViewport; annotationMode: number }): { promise: Promise<void> };
	}

	interface PDFDocument {
		numPages: number;
		getPage(page: number): Promise<PDFPage>;
	}

	export function getDocument(options: DocumentOptions): { promise: Promise<PDFDocument>; destroy(): Promise<void> };
}

declare module 'pdfjs-parser' {
	export const WorkerMessageHandler: { initializeFromPort(port: MessagePort): void };
}
