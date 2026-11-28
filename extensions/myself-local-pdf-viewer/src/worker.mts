/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AnnotationMode, getDocument, PDFWorker, VerbosityLevel } from 'pdfjs-display';
import { WorkerMessageHandler } from 'pdfjs-parser';
import type { RenderFailure, RenderReply, RenderRequest, RenderedPixels } from './protocol.js';

const maxPdfBytes = 16 * 1024 * 1024;
const maxPages = 200;
const maxDimension = 2048;
const maxPagePixels = 2_000_000;
const maxCanvasPixels = 8_000_000;

class PreviewLimit extends Error {}
class AuxiliaryAssetUnavailable extends Error {}

interface CanvasSurface {
	canvas: OffscreenCanvas | null;
	context: OffscreenCanvasRenderingContext2D | null;
}

class CanvasBudget {
	#pixels = 0;
	#sizes = new WeakMap<OffscreenCanvas, number>();

	#resize(canvas: OffscreenCanvas, width: number, height: number) {
		const pixels = width * height;
		const previous = this.#sizes.get(canvas) ?? 0;
		const total = this.#pixels - previous + pixels;
		if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
			width > maxDimension || height > maxDimension || pixels > maxPagePixels || total > maxCanvasPixels) {
			throw new PreviewLimit();
		}
		// Reduce the first dimension before enlarging the second one.
		if (width < canvas.width) {
			canvas.width = width;
			canvas.height = height;
		} else {
			canvas.height = height;
			canvas.width = width;
		}
		this.#pixels = total;
		this.#sizes.set(canvas, pixels);
	}

	create(width: number, height: number, alpha = true) {
		const canvas = new OffscreenCanvas(1, 1);
		this.#resize(canvas, width, height);
		return { canvas, context: alpha ? canvas.getContext('2d', { willReadFrequently: true }) : this.getNoAlphaContext(canvas) };
	}

	getNoAlphaContext(canvas: OffscreenCanvas) {
		return canvas.getContext('2d', { alpha: false, willReadFrequently: true });
	}

	reset({ canvas }: CanvasSurface, width: number, height: number) {
		this.#resize(canvas!, width, height);
	}

	destroy(surface: CanvasSurface) {
		const { canvas } = surface;
		this.#pixels -= this.#sizes.get(canvas!) ?? 0;
		this.#sizes.delete(canvas!);
		canvas!.width = canvas!.height = 0;
		surface.canvas = surface.context = null;
	}
}

class NoDomFilters {
	destroy() {}
}

async function renderPage(bytes: Uint8Array<ArrayBuffer>, pageNumber: number, onPageCount: (count: number) => void): Promise<RenderedPixels> {
	if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > maxPdfBytes ||
		!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > maxPages) {
		throw new PreviewLimit();
	}

	const { port1, port2 } = new MessageChannel();
	WorkerMessageHandler.initializeFromPort(port1);
	const worker = PDFWorker.create({ port: port2 });
	port1.start();
	port2.start();
	const budget = new CanvasBudget();
	let auxiliaryAssetRequested = false;
	const task = getDocument({
		data: bytes,
		verbosity: VerbosityLevel.ERRORS,
		worker,
		CanvasFactory: class extends CanvasBudget {
			constructor() {
				super();
				return budget;
			}
		},
		FilterFactory: NoDomFilters,
		BinaryDataFactory: class {
			fetch(): never {
				auxiliaryAssetRequested = true;
				throw new AuxiliaryAssetUnavailable();
			}
		},
		enableXfa: false,
		enableHWA: false,
		enableWebGPU: false,
		disableWorkerRendering: true,
		useWasm: false,
		useSystemFonts: false,
		disableFontFace: true,
		useWorkerFetch: false,
		disableAutoFetch: true,
		disableStream: true,
		disableRange: true,
		isOffscreenCanvasSupported: false,
		isImageDecoderSupported: false,
		maxImageSize: maxPagePixels,
		canvasMaxAreaInBytes: maxPagePixels * 4,
		stopAtErrors: true,
	});
	try {
		const document = await task.promise;
		if (!Number.isInteger(document.numPages) || document.numPages > maxPages || pageNumber > document.numPages) {
			throw new PreviewLimit();
		}
		onPageCount(document.numPages);
		const page = await document.getPage(pageNumber);
		const initial = page.getViewport({ scale: 1 });
		if (!Number.isFinite(initial.width) || !Number.isFinite(initial.height) ||
			initial.width <= 0 || initial.height <= 0 || initial.width > 20_000 || initial.height > 20_000) {
			throw new PreviewLimit();
		}
		const scale = Math.min(2, maxDimension / Math.max(initial.width, initial.height), Math.sqrt(maxPagePixels / (initial.width * initial.height)));
		const viewport = page.getViewport({ scale });
		const width = Math.max(1, Math.floor(viewport.width));
		const height = Math.max(1, Math.floor(viewport.height));
		const surface = budget.create(width, height, false);
		try {
			try {
				await page.render({ canvas: surface.canvas, viewport, annotationMode: AnnotationMode.DISABLE }).promise;
			} catch (error) {
				if (!auxiliaryAssetRequested) {
					throw error;
				}
			}
			if (auxiliaryAssetRequested) {
				throw new AuxiliaryAssetUnavailable();
			}
			const rgba = surface.context!.getImageData(0, 0, width, height).data;
			return { width, height, rgba };
		} finally {
			budget.destroy(surface);
		}
	} finally {
		try { await task.destroy(); } finally {
			worker.destroy();
			port1.close();
			port2.close();
		}
	}
}

let started = false;
(self as DedicatedWorkerGlobalScope).addEventListener('message', async ({ data, ports: [reply] }: MessageEvent<RenderRequest>) => {
	if (started || data?.kind !== 'render-pdf-page' || !reply) {
		return;
	}
	started = true;
	let pageCount: number | undefined;
	try {
		const result = await renderPage(data.bytes, data.pageNumber, count => { pageCount = count; });
		reply.postMessage({ kind: 'rendered', pageCount: pageCount!, ...result } satisfies RenderReply, [result.rgba.buffer]);
	} catch (error) {
		let reason: RenderFailure = 'unsupported';
		if (error instanceof PreviewLimit) {
			reason = 'limit';
		} else if (error instanceof AuxiliaryAssetUnavailable) {
			reason = 'resource';
		} else if ((error as Error | undefined)?.name === 'PasswordException') {
			reason = 'password';
		}
		reply.postMessage({ kind: 'failed', reason, pageCount } satisfies RenderReply);
	}
});
