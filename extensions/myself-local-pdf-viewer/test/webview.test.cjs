/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { after, before, test } = require('node:test');
const { vectorDocument } = require('./pdf-fixture.cjs');
const { chromium } = require(process.env.NERDED_PDF_PLAYWRIGHT || 'playwright-core');

const address = 'https://local-pdf-webview.invalid/';
const archive = process.env.NERDED_PDF_TEST_VSIX;
let browser;
let engine;
let packagedHtml;
const text = {
	title: 'Local PDF Preview', previous: 'Previous Page', next: 'Next Page', position: 'Page {page} of {count}',
	coverage: 'Limited preview', canvas: 'Rendered PDF page', loading: 'Loading', resource: 'Resource unavailable',
	limit: 'Too large', password: 'Password protected', timeout: 'Timed out', unsupported: 'Unsupported', worker: 'Worker unavailable',
};

function extract(entry) {
	return execFileSync('unzip', ['-p', archive, 'extension/' + entry], { maxBuffer: 4 * 1024 * 1024 });
}

before(async () => {
	assert.ok(archive, 'Pass the built VSIX in NERDED_PDF_TEST_VSIX');
	engine = extract('worker.mjs');
	// Evaluate the packaged view factory as CommonJS. It only imports node:crypto.
	const createPreviewHtml = new Function('require', 'module', extract('view.cjs').toString() + '\nreturn module.exports.createPreviewHtml;')(require, {});
	packagedHtml = createPreviewHtml(extract('preview.js').toString(), text, 'en');
	browser = await chromium.launch({ headless: true });
});

after(async () => browser?.close());

async function withWebview(run, { worker = engine, pdf = vectorDocument() } = {}) {
	const context = await browser.newContext({ serviceWorkers: 'block' });
	const requests = [];
	const popups = [];
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
		const errors = [];
		page.on('console', message => {
			if (message.type() === 'error') { errors.push(message.text()); }
		});
		page.on('pageerror', error => errors.push(error.message));
		page.on('popup', popup => popups.push(popup));
		await page.addInitScript(() => {
			window.printCalls = 0;
			window.print = () => window.printCalls++;
			window.messages = [];
			window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message) });
		});
		await page.goto(address);
		await context.setOffline(true);
		await page.evaluate(({ pdf64, engine64, token }) => {
			postMessage({
				kind: 'document', token,
				bytes: Uint8Array.fromBase64(pdf64).buffer,
				engine: Uint8Array.fromBase64(engine64).buffer,
			}, location.origin);
		}, { pdf64: pdf.toString('base64'), engine64: worker.toString('base64'), token: packagedHtml.token });
		try {
			await run(page);
		} catch (error) {
			console.log({ status: await page.locator('#status').textContent(), errors });
			throw error;
		}
		assert.deepEqual(requests, []);
		assert.deepEqual(popups, []);
		assert.deepEqual(await page.evaluate(() => [
			window.printCalls, document.querySelectorAll('a, iframe, object, embed, form').length, window.messages.map(message => message.kind),
		]), [0, 0, ['ready']]);
	} finally {
		await context.close();
	}
}

async function pixels(page) {
	return await page.locator('canvas').evaluate(canvas => [
		canvas.width, canvas.height, ...canvas.getContext('2d').getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data,
	]);
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
