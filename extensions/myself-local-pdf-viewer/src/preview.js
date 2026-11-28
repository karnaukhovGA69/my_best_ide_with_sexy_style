/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

(() => {
	const api = acquireVsCodeApi();
	const token = document.currentScript.nonce;
	const text = document.body.dataset;
	const canvas = document.getElementById('page');
	const status = document.getElementById('status');
	const position = document.getElementById('position');
	const previous = document.getElementById('previous');
	const next = document.getElementById('next');
	const maxPdfBytes = 16 * 1024 * 1024;
	const maxPages = 200;
	const renderDeadlineMs = 5000;
	let bytes;
	let workerUrl;
	let active;
	let pageNumber = 1;
	let pageCount = 0;
	let closed = false;

	function showStatus(message) {
		status.hidden = !message;
		status.textContent = message;
	}

	function updateControls() {
		previous.disabled = !workerUrl || pageNumber <= 1;
		next.disabled = !workerUrl || !pageCount || pageNumber >= pageCount;
		position.textContent = pageCount ? text.position.replace('{page}', String(pageNumber)).replace('{count}', String(pageCount)) : '';
	}

	function resetCanvas() {
		canvas.hidden = true;
		canvas.width = canvas.height = 0;
	}

	function render(number) {
		active?.cancel();
		pageNumber = number;
		resetCanvas();
		updateControls();
		showStatus(text.loading);
		let worker;
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

		function finish(message) {
			if (active === request) {
				request.cancel();
				showStatus(message);
			}
		}

		worker.onerror = () => finish(text.worker);
		port1.onmessageerror = () => finish(text.worker);
		port1.onmessage = ({ data }) => {
			if (active !== request) {
				return;
			}
			if (data?.kind === 'failed') {
				if (Number.isInteger(data.pageCount) && data.pageCount >= pageNumber && data.pageCount <= maxPages) {
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
			const { width, height, rgba, pageCount: count } = data ?? {};
			if (data?.kind !== 'rendered' ||
				!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
				width > 2048 || height > 2048 || width * height > 2_000_000 ||
				!(rgba instanceof Uint8ClampedArray) || rgba.byteLength !== width * height * 4 ||
				!Number.isInteger(count) || count < pageNumber || count > maxPages) {
				finish(text.unsupported);
				return;
			}
			try {
				canvas.width = width;
				canvas.height = height;
				canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
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
			worker.postMessage({ kind: 'render-pdf-page', pageNumber: number, bytes: copy }, [copy.buffer, port2]);
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
	window.addEventListener('message', ({ data }) => {
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
