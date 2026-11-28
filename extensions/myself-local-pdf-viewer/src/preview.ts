/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { DocumentMessage, ReadyMessage, RenderReply, RenderRequest } from './protocol.js';

declare function acquireVsCodeApi(): { postMessage(message: ReadyMessage): void };

function findElement<T extends HTMLElement>(id: string, elementType: new () => T): T {
	const element = document.getElementById(id);
	if (!(element instanceof elementType)) {
		throw new Error('Missing PDF preview element');
	}
	return element;
}

(() => {
	const api = acquireVsCodeApi();
	const script = document.currentScript;
	if (!(script instanceof HTMLScriptElement)) {
		throw new Error('Missing PDF preview script');
	}
	const token = script.nonce;
	const text = document.body.dataset;
	const canvas = findElement('page', HTMLCanvasElement);
	const status = findElement('status', HTMLParagraphElement);
	const position = findElement('position', HTMLSpanElement);
	const previous = findElement('previous', HTMLButtonElement);
	const next = findElement('next', HTMLButtonElement);
	const maxPdfBytes = 16 * 1024 * 1024;
	const maxPages = 200;
	const renderDeadlineMs = 5000;
	let bytes: ArrayBuffer | undefined;
	let workerUrl: string | undefined;
	let active: { cancel(): void } | undefined;
	let pageNumber = 1;
	let pageCount = 0;
	let closed = false;

	function showStatus(message: string | undefined) {
		status.hidden = !message;
		status.textContent = message ?? '';
	}

	function updateControls() {
		previous.disabled = !workerUrl || pageNumber <= 1;
		next.disabled = !workerUrl || !pageCount || pageNumber >= pageCount;
		position.textContent = pageCount ? (text.position ?? '').replace('{page}', String(pageNumber)).replace('{count}', String(pageCount)) : '';
	}

	function resetCanvas() {
		canvas.hidden = true;
		canvas.width = canvas.height = 0;
	}

	function render(number: number) {
		if (!bytes || !workerUrl) {
			return;
		}
		active?.cancel();
		pageNumber = number;
		resetCanvas();
		updateControls();
		showStatus(text.loading);
		let worker: Worker;
		try {
			worker = new Worker(workerUrl, { type: 'module' });
		} catch {
			showStatus(text.worker);
			return;
		}
		// PDF.js's global worker protocol is separate from the preview protocol.
		const { port1, port2 } = new MessageChannel();
		const request = {
			cancel() {
				clearTimeout(deadline);
				port1.close();
				worker.terminate();
				if (active === request) {
					active = undefined;
				}
			},
		};
		const deadline = setTimeout(() => finish(text.timeout), renderDeadlineMs);
		active = request;

		function finish(message: string | undefined) {
			if (active === request) {
				request.cancel();
				showStatus(message);
			}
		}

		worker.onerror = () => finish(text.worker);
		port1.onmessageerror = () => finish(text.worker);
		port1.onmessage = ({ data }: MessageEvent<RenderReply>) => {
			if (active !== request) {
				return;
			}
			if (data?.kind === 'failed') {
				if (typeof data.pageCount === 'number' && Number.isInteger(data.pageCount) && data.pageCount >= pageNumber && data.pageCount <= maxPages) {
					pageCount = data.pageCount;
					updateControls();
				}
				switch (data.reason) {
					case 'limit': return finish(text.limit);
					case 'resource': return finish(text.resource);
					case 'password': return finish(text.password);
					default: return finish(text.unsupported);
				}
			}
			if (data?.kind !== 'rendered') {
				finish(text.unsupported);
				return;
			}
			const { width, height, rgba, pageCount: count } = data;
			if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
				width > 2048 || height > 2048 || width * height > 2_000_000 ||
				!(rgba instanceof Uint8ClampedArray) || rgba.byteLength !== width * height * 4 ||
				!Number.isInteger(count) || count < pageNumber || count > maxPages) {
				finish(text.unsupported);
				return;
			}
			try {
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext('2d');
				if (!context) {
					throw new Error('Unavailable canvas context');
				}
				context.putImageData(new ImageData(rgba, width, height), 0, 0);
				canvas.hidden = false;
				pageCount = count;
				updateControls();
				finish('');
			} catch {
				resetCanvas();
				finish(text.unsupported);
			}
		};
		const copy = new Uint8Array(bytes.slice(0));
		try {
			const payload: RenderRequest = { kind: 'render-pdf-page', pageNumber: number, bytes: copy };
			worker.postMessage(payload, [copy.buffer, port2]);
		} catch {
			port2.close();
			finish(text.worker);
		}
	}

	previous.addEventListener('click', () => {
		if (!previous.disabled) {
			render(pageNumber - 1);
		}
	});
	next.addEventListener('click', () => {
		if (!next.disabled) {
			render(pageNumber + 1);
		}
	});
	window.addEventListener('message', ({ data }: MessageEvent<DocumentMessage>) => {
		if (workerUrl || closed || data?.kind !== 'document' || data.token !== token) {
			return;
		}
		if (!(data.bytes instanceof ArrayBuffer) || data.bytes.byteLength === 0 || data.bytes.byteLength > maxPdfBytes) {
			showStatus(text.limit);
			return;
		}
		if (!(data.engine instanceof ArrayBuffer) || data.engine.byteLength === 0 || data.engine.byteLength > 4 * 1024 * 1024) {
			showStatus(text.worker);
			return;
		}
		bytes = data.bytes;
		workerUrl = URL.createObjectURL(new Blob([data.engine], { type: 'text/javascript' }));
		render(1);
	});
	window.addEventListener('pagehide', () => {
		closed = true;
		active?.cancel();
		if (workerUrl) {
			URL.revokeObjectURL(workerUrl);
		}
		bytes = undefined;
	}, { once: true });

	api.postMessage({ kind: 'ready', token });
})();
