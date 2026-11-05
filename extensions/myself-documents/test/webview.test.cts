/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { loadWithVscode, viewApi, uri } = require('./helpers.cts');
let server, browser, origin;
const { editorHtml } = loadWithVscode('view.js', viewApi);
before(async () => {
	server = http.createServer((request, response) => {
		if (request.url === '/') {
			response.setHeader('Content-Type', 'text/html');
			response.end(editorHtml({ cspSource: origin, asWebviewUri: value => value.toString() }, uri(origin + '/media'), uri(origin + '/media/editor.js')));
		} else if (['/media/editor.css', '/media/editor.js'].includes(request.url)) {
			response.setHeader('Content-Type', request.url.endsWith('.js') ? 'application/javascript' : 'text/css');
			response.end(fs.readFileSync(path.join(__dirname, '..', request.url.endsWith('.js') ? 'out/webview/editor.js' : 'media/editor.css')));
		} else { response.writeHead(404); response.end(); }
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	origin = `http://127.0.0.1:${server.address().port}`;
	browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
async function open(restored) {
	const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
	await page.addInitScript(state => {
		window.messages = [];
		window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message), getState: () => state, setState: next => { window.persisted = next; } });
	}, restored);
	await page.goto(origin);
	await page.addStyleTag({ content: ':root { --vscode-foreground: #25282c; --vscode-sideBar-background: #f3f4f5; --vscode-editor-background: #fff; --vscode-editor-foreground: #25282c; --vscode-font-family: system-ui, sans-serif; --vscode-font-size: 13px; --vscode-descriptionForeground: #646a73; --vscode-input-foreground: #25282c; --vscode-input-background: #fff; --vscode-input-border: #c6cad0; --vscode-button-secondaryForeground: #25282c; --vscode-button-secondaryBackground: #e9ebee; --vscode-button-secondaryHoverBackground: #dce0e5; --vscode-button-foreground: #fff; --vscode-button-background: #2463bb; --vscode-button-hoverBackground: #19539f; --vscode-focusBorder: #2463bb; --vscode-panel-border: #d6d9de; }' });
	await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'));
	await snapshot(page, { text: 'а)1\n\nб)3', version: 1, dirty: false, name: 'Essay.txt' });
	return page;
}
async function snapshot(page, value) {
	await page.evaluate(message => window.postMessage({ type: 'snapshot', ...message }, '*'), value);
	await page.waitForTimeout(20);
}
const messages = page => page.evaluate(() => window.messages);

test('fast typing survives delayed acknowledgements and export flushes the latest text', async () => {
	const page = await open();
	try {
		await page.locator('#text').fill('а)1\n\nб)3\nEssay');
		await page.locator('#text').fill('а)1\n\nб)3\nEssay 😀');
		await page.locator('#export').click();
		let edits = (await messages(page)).filter(m => m.type === 'edit');
		assert.equal(edits.length, 1);
		await snapshot(page, { text: edits[0].text, version: 2, dirty: true, ack: edits[0].id });
		edits = (await messages(page)).filter(m => m.type === 'edit');
		assert.equal(edits.length, 2);
		assert.equal((await messages(page)).some(m => m.type === 'action'), false);
		await snapshot(page, { text: edits[1].text, version: 3, dirty: true, ack: edits[1].id });
		const action = (await messages(page)).find(m => m.type === 'action');
		assert.deepEqual({ value: await page.locator('#text').inputValue(), action }, {
			value: 'а)1\n\nб)3\nEssay 😀', action: { type: 'action', action: 'export', version: 3, page: { size: 'A4', fontFamily: 'serif', fontSizePt: 12, lineHeight: 1.5, marginMm: 20 } }
		});
	} finally { await page.close(); }
});

test('external change preserves the draft until an explicit conflict decision', async () => {
	const page = await open();
	try {
		await page.locator('#text').fill('local draft');
		const edit = (await messages(page)).find(m => m.type === 'edit');
		await snapshot(page, { text: 'external', version: 2, dirty: false, conflict: true, ack: edit.id });
		assert.equal(await page.locator('#text').inputValue(), 'local draft');
		assert.equal(await page.locator('#conflict').isVisible(), true);
		assert.equal(await page.locator('#export').isDisabled(), true);
		await page.locator('#keepDraft').click();
		const next = (await messages(page)).filter(m => m.type === 'edit').at(-1);
		assert.deepEqual({ version: next.version, text: next.text }, { version: 2, text: 'local draft' });
	} finally { await page.close(); }
});

test('reload restores a pending draft and surfaces a conflict with changed disk text', async () => {
	const page = await open({ base: 'old text', draft: 'recovered draft', page: { size: 'A4', fontFamily: 'monospace', fontSizePt: 14, lineHeight: 1.8, marginMm: 15 } });
	try {
		assert.equal(await page.locator('#text').inputValue(), 'recovered draft');
		assert.equal(await page.locator('#conflict').isVisible(), true);
		assert.equal(await page.locator('#fontSize').inputValue(), '14');
		await page.locator('#useFile').click();
		assert.equal(await page.locator('#text').inputValue(), 'а)1\n\nб)3');
		assert.equal((await messages(page)).some(m => m.type === 'edit'), false);
	} finally { await page.close(); }
});

test('preview settings do not edit text; find and narrow layout remain usable', async () => {
	const page = await open();
	try {
		await page.locator('#margin').fill('25');
		await page.locator('#font').selectOption('sans-serif');
		await page.locator('#query').fill('б)3');
		await page.locator('#findNext').click();
		assert.equal(await page.locator('#text').evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd)), 'б)3');
		assert.equal((await messages(page)).some(m => m.type === 'edit'), false);
		await page.locator('#margin').fill('99');
		assert.equal(await page.locator('#export').isDisabled(), true);
		await page.locator('#margin').fill('20');
		if (process.env.DOCUMENTS_SCREENSHOT) { await page.screenshot({ path: process.env.DOCUMENTS_SCREENSHOT + '.desktop.png', fullPage: true }); }
		await page.setViewportSize({ width: 420, height: 800 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		if (process.env.DOCUMENTS_SCREENSHOT) {
			await page.screenshot({ path: process.env.DOCUMENTS_SCREENSHOT + '.mobile.png', fullPage: true });
		}
	} finally { await page.close(); }
});

test('text is literal, and keyboard undo is routed to document history', async () => {
	const page = await open();
	try {
		await snapshot(page, { text: '<img src=x onerror=alert(1)>\nHello', version: 2, dirty: false });
		assert.equal(await page.locator('img').count(), 0);
		await page.locator('#text').focus();
		await page.keyboard.press('Control+z');
		assert.equal((await messages(page)).find(m => m.type === 'action').action, 'undo');
	} finally { await page.close(); }
});

test('find uses original Unicode offsets, literal queries and wraps to the first match', async () => {
	const page = await open();
	try {
		await snapshot(page, { text: 'İ 😀 ТЕКСТ a+b [x] текст', version: 2, dirty: false, name: 'Unicode.txt' });
		await page.locator('#text').evaluate(el => el.setSelectionRange(0, 0));
		const selected = () => page.locator('#text').evaluate(el => ({ start: el.selectionStart, value: el.value.slice(el.selectionStart, el.selectionEnd) }));
		await page.locator('#query').fill('текст');
		await page.locator('#findNext').click();
		assert.deepEqual(await selected(), { start: 5, value: 'ТЕКСТ' });
		await page.locator('#query').focus();
		await page.locator('#query').press('Enter');
		assert.deepEqual(await selected(), { start: 19, value: 'текст' });
		await page.locator('#findNext').click();
		assert.deepEqual(await selected(), { start: 5, value: 'ТЕКСТ' });
		for (const query of ['a+b', '[x]']) {
			await page.locator('#query').fill(query);
			await page.locator('#findNext').click();
			assert.equal((await selected()).value, query);
		}
		const before = await selected();
		await page.locator('#query').fill('missing');
		await page.locator('#findNext').click();
		assert.deepEqual(await selected(), before);
		assert.equal((await messages(page)).some(m => m.type === 'edit'), false);
	} finally { await page.close(); }
});
