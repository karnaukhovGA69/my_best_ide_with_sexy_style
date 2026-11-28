/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, test } from 'node:test';
import type { Browser, Page } from 'playwright-core';
import { documentPdfHtml } from '../../../src/vs/platform/documentExport/common/documentExport.ts';
import type { DocumentMessage, PreviewText, ReadyMessage } from '../src/protocol.js';
import type { createPreviewHtml } from '../src/view.cjs';
import { imageXObjectDocument, vectorDocument } from './pdf-fixture.mts';

const require = createRequire(import.meta.url);
const { chromium }: typeof import('playwright-core') = require(process.env.NERDED_PDF_PLAYWRIGHT || 'playwright-core');

interface FixtureWindow extends Window {
	printCalls: number;
	messages: ReadyMessage[];
	acquireVsCodeApi(): { postMessage(message: ReadyMessage): void };
}

const address = 'https://local-pdf-webview.invalid/';
const archive = process.env.NERDED_PDF_TEST_VSIX ?? '';
assert.ok(archive, 'Pass the built VSIX in NERDED_PDF_TEST_VSIX');
let browser: Browser;
let engine: Buffer;
let packagedHtml: ReturnType<typeof createPreviewHtml>;
const text: PreviewText = {
	title: 'Local PDF Preview', previous: 'Previous Page', next: 'Next Page', position: 'Page {page} of {count}',
	coverage: 'Limited preview', canvas: 'Rendered PDF page', loading: 'Loading', resource: 'Resource unavailable',
	limit: 'Too large', password: 'Password protected', timeout: 'Timed out', unsupported: 'Unsupported', worker: 'Worker unavailable',
};

function extract(entry: string) {
	return execFileSync('unzip', ['-p', archive, 'extension/' + entry], { maxBuffer: 4 * 1024 * 1024 });
}

before(async () => {
	engine = extract('worker.mjs');
	const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'nerded-pdf-webview-test-'));
	try {
		const file = path.join(temporary, 'view.cjs');
		await fs.writeFile(file, extract('view.cjs'));
		const view: typeof import('../src/view.cjs') = require(file);
		packagedHtml = view.createPreviewHtml(extract('preview.js').toString(), text, 'en');
	} finally {
		await fs.rm(temporary, { recursive: true, force: true });
	}
	browser = await chromium.launch({ headless: true });
});

after(async () => browser?.close());

async function withWebview(run: (page: Page) => Promise<void>, { worker = engine, pdf = vectorDocument() } = {}) {
	const context = await browser.newContext({ serviceWorkers: 'block' });
	const requests: string[] = [];
	const popups: Page[] = [];
	let served = false;
	try {
		await context.route('**/*', route => {
			const url = route.request().url();
			if (url === address && !served && route.request().isNavigationRequest()) {
				served = true;
				return route.fulfill({ contentType: 'text/html', body: packagedHtml.html });
			}
			requests.push(url);
			return route.abort();
		});
		const page = await context.newPage();
		page.setDefaultTimeout(8000);
		const errors: string[] = [];
		page.on('console', message => {
			if (message.type() === 'error') { errors.push(message.text()); }
		});
		page.on('pageerror', error => errors.push(error.message));
		page.on('popup', popup => popups.push(popup));
		await page.addInitScript(() => {
			const view = window as unknown as FixtureWindow;
			view.printCalls = 0;
			view.print = () => view.printCalls++;
			view.messages = [];
			view.acquireVsCodeApi = () => ({ postMessage: message => view.messages.push(message) });
		});
		await page.goto(address);
		await context.setOffline(true);
		await page.evaluate(({ pdf64, engine64, token }) => {
			const decode = (base64: string) => Uint8Array.from(atob(base64), character => character.charCodeAt(0)).buffer;
			const payload: DocumentMessage = { kind: 'document', token, bytes: decode(pdf64), engine: decode(engine64) };
			postMessage(payload, location.origin);
		}, { pdf64: pdf.toString('base64'), engine64: worker.toString('base64'), token: packagedHtml.token });
		try {
			await run(page);
		} catch (error) {
			console.log({ status: await page.locator('#status').textContent(), errors });
			throw error;
		}
		assert.deepEqual(requests, []);
		assert.deepEqual(popups, []);
		assert.deepEqual(await page.evaluate(() => {
			const view = window as unknown as FixtureWindow;
			return [view.printCalls, document.querySelectorAll('a, iframe, object, embed, form').length, view.messages.map(message => message.kind)];
		}), [0, 0, ['ready']]);
	} finally {
		await context.close();
	}
}

async function pixels(page: Page) {
	return await page.locator('canvas').evaluate(canvas => {
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Missing preview canvas');
		}
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Missing canvas context');
		}
		return [canvas.width, canvas.height, ...context.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data];
	});
}

test('packaged PDF.js navigates the vector fixture offline under the actual CSP, with no active links or print', async () => {
	await withWebview(async page => {
		await page.locator('canvas').waitFor();
		assert.equal(await page.locator('#position').textContent(), 'Page 1 of 2');
		assert.deepEqual(await pixels(page), [80, 80, 255, 0, 0, 255]);
		await page.getByRole('button', { name: 'Next Page' }).click();
		await page.locator('canvas').waitFor();
		assert.deepEqual(await pixels(page), [80, 80, 0, 0, 255, 255]);
		await page.getByRole('button', { name: 'Previous Page' }).click();
		await page.locator('canvas').waitFor();
		assert.deepEqual(await pixels(page), [80, 80, 255, 0, 0, 255]);
	});
});

test('the packaged worker renders the embedded synthetic glyph', async () => {
	await withWebview(async page => {
		await page.locator('canvas').waitFor();
		assert.deepEqual(await pixels(page), [80, 80, 0, 0, 0, 255]);
	}, { pdf: vectorDocument({ font: 'embedded' }) });
});

test('corrupt non-inline JPEG rejects the page without publishing partial pixels', async () => {
	const incompleteJpeg = Buffer.from('not-a-valid-jpeg');
	for (const withVector of [false, true]) {
		await withWebview(async page => {
			await page.waitForFunction(() => {
				const canvas = document.querySelector('canvas');
				const status = document.querySelector('#status');
				return !canvas?.hidden || status?.textContent === 'Unsupported';
			});
			assert.deepEqual([await page.locator('#status').textContent(), await page.locator('canvas').isVisible()], ['Unsupported', false]);
		}, { pdf: imageXObjectDocument(incompleteJpeg, 'DCTDecode', withVector) });
	}
});

test('the QA embedded image control and a valid JPEG both paint red pixels', async () => {
	await withWebview(async page => {
		await page.locator('canvas').waitFor();
		assert.deepEqual(await pixels(page), [80, 80, 255, 0, 0, 255]);
	}, { pdf: imageXObjectDocument(Buffer.from('FF0000>'), 'ASCIIHexDecode') });
	// A programmatically generated 1×1 red JPEG.
	const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwn/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAAYqm//Z', 'base64');
	await withWebview(async page => {
		await page.locator('canvas').waitFor();
		const [width, height, red, green, blue, alpha] = await pixels(page);
		assert.deepEqual([width, height, alpha], [80, 80, 255]);
		assert.ok(red > 240 && green < 16 && blue < 16);
	}, { pdf: imageXObjectDocument(jpeg, 'DCTDecode') });
});

test('the packaged worker renders Latin and Cyrillic pages from the document exporter in all three font families', async () => {
	for (const fontFamily of ['sans-serif', 'serif', 'monospace']) {
		const printing = await browser.newContext({ javaScriptEnabled: false, offline: true });
		let pdf: Buffer;
		try {
			const page = await printing.newPage();
			await page.setContent(documentPdfHtml({
				version: 2,
				format: 'directives',
				text: '@title Offline export\nLatin text 123 · Café\n@note Проверка кириллицы\n@page\n@title Page two\nВторая страница',
				suggestedFileName: 'synthetic.pdf',
				page: { size: 'A4', marginMm: 20, fontFamily, fontSizePt: 16, lineHeight: 1.5 },
			}));
			pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } });
		} finally {
			await printing.close();
		}
		await withWebview(async page => {
			for (const number of [1, 2]) {
				await page.locator('canvas').waitFor();
				const position = await page.locator('#position').textContent();
				const darkPixels = await page.locator('canvas').evaluate(canvas => {
					if (!(canvas instanceof HTMLCanvasElement)) {
						return 0;
					}
					const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
					let count = 0;
					for (let offset = 0; data && offset < data.length; offset += 4) {
						if (data[offset] < 180 && data[offset + 1] < 180 && data[offset + 2] < 180 && data[offset + 3] === 255) {
							count++;
						}
					}
					return count;
				});
				assert.equal(position, `Page ${number} of 2`, fontFamily);
				assert.ok(darkPixels > 100, `Expected exported text on page ${number} in ${fontFamily}`);
				if (number === 1) {
					await page.getByRole('button', { name: 'Next Page' }).click();
				}
			}
		}, { pdf });
	}
});

test('missing font has a specific message and the next available page remains usable', async () => {
	await withWebview(async page => {
		await page.getByText('Resource unavailable').waitFor();
		assert.equal(await page.locator('canvas').isVisible(), false);
		await page.getByRole('button', { name: 'Next Page' }).click();
		await page.locator('canvas').waitFor();
		assert.deepEqual(await pixels(page), [80, 80, 0, 0, 255, 255]);
	}, { pdf: vectorDocument({ font: 'standard' }) });
});

test('an over-limit document exposes no pixels', async () => {
	await withWebview(async page => {
		await page.getByText('Too large').waitFor();
		assert.equal(await page.locator('canvas').isVisible(), false);
	}, { pdf: vectorDocument({ pageCount: 201 }) });
});

test('a busy worker is terminated and reports timeout', async () => {
	await withWebview(async page => {
		const worker = page.workers()[0] ?? await page.waitForEvent('worker');
		const closed = worker.waitForEvent('close');
		await page.getByText('Timed out').waitFor({ timeout: 8000 });
		await closed;
		assert.equal(await page.locator('canvas').isVisible(), false);
		assert.equal(page.workers().length, 0);
	}, { worker: Buffer.from('self.onmessage = () => { for (;;) {} };') });
});

test('changing pages during a render replaces the worker and cannot paint stale pixels', async () => {
	const worker = Buffer.from(`self.onmessage = ({ data, ports: [reply] }) => {
		if (data.pageNumber === 2) {
			setTimeout(() => reply.postMessage({ kind: 'rendered', pageCount: 2, width: 1, height: 1, rgba: new Uint8ClampedArray([0,0,255,255]) }), 1200);
		} else {
			reply.postMessage({ kind: 'rendered', pageCount: 2, width: 1, height: 1, rgba: new Uint8ClampedArray([255,0,0,255]) });
		}
	};`);
	await withWebview(async page => {
		await page.locator('canvas').waitFor();
		const pending = page.waitForEvent('worker');
		await page.getByRole('button', { name: 'Next Page' }).click();
		const stale = await pending;
		await page.getByText('Page 2 of 2').waitFor();
		const closed = stale.waitForEvent('close');
		await page.getByRole('button', { name: 'Previous Page' }).click();
		await closed;
		await page.locator('canvas').waitFor();
		assert.deepEqual(await pixels(page), [1, 1, 255, 0, 0, 255]);
	}, { worker });
});

test('worker CSP blocks outbound connections', async () => {
	const worker = Buffer.from(`self.onmessage = ({ ports: [reply] }) => {
		self.addEventListener('securitypolicyviolation', event => {
			if (event.effectiveDirective === 'connect-src') {
				reply.postMessage({ kind: 'failed', reason: 'resource' });
			}
		});
		fetch('https://pdf-worker-network.invalid/').catch(() => {});
	};`);
	await withWebview(async page => {
		await page.getByText('Resource unavailable').waitFor();
		assert.equal(await page.locator('canvas').isVisible(), false);
	}, { worker });
});
