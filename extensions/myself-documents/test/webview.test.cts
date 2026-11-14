/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
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
async function open(restored, forwardHistoryKeys = false, initialText = 'а)1\n\nб)3') {
	const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
	await page.addInitScript(({ state, forwardHistoryKeys }) => {
		window.messages = [];
		window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message), getState: () => state, setState: next => { window.persisted = next; } });
		if (forwardHistoryKeys) {
			// The workbench webview shell forwards Undo/Redo from a bubbling window
			// listener even when the extension has called preventDefault().
			window.addEventListener('keydown', event => {
				if ((event.metaKey || event.ctrlKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
					event.preventDefault();
					window.messages.push({ type: 'forwardedHistoryKey' });
				}
			});
		}
	}, { state: restored, forwardHistoryKeys });
	await page.goto(origin);
	await page.addStyleTag({ content: ':root { --vscode-foreground: #25282c; --vscode-sideBar-background: #f3f4f5; --vscode-editor-background: #fff; --vscode-editor-foreground: #25282c; --vscode-font-family: system-ui, sans-serif; --vscode-font-size: 13px; --vscode-descriptionForeground: #646a73; --vscode-input-foreground: #25282c; --vscode-input-background: #fff; --vscode-input-border: #c6cad0; --vscode-button-secondaryForeground: #25282c; --vscode-button-secondaryBackground: #e9ebee; --vscode-button-secondaryHoverBackground: #dce0e5; --vscode-button-foreground: #fff; --vscode-button-background: #2463bb; --vscode-button-hoverBackground: #19539f; --vscode-focusBorder: #2463bb; --vscode-panel-border: #d6d9de; }' });
	await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'));
	await snapshot(page, { text: initialText, version: 1, dirty: false, name: 'Essay.txt' });
	return page;
}
async function snapshot(page, value) {
	await page.evaluate(message => window.postMessage({ type: 'snapshot', ...message }, '*'), value);
	await page.waitForTimeout(20);
}
const messages = page => page.evaluate(() => window.messages);

test('document counts follow typing, clipboard paste and deletion before any acknowledgement', async () => {
	const page = await open(undefined, false, '');
	try {
		const text = page.locator('#text');
		const counts = page.locator('#document-counts');
		await expect(counts).toHaveText('Words: 0 Characters with spaces: 0');
		await text.focus();
		await page.keyboard.insertText('Привет');
		await expect(counts).toHaveText('Words: 1 Characters with spaces: 6');
		await page.keyboard.insertText(' мир');
		await expect(counts).toHaveText('Words: 2 Characters with spaces: 10');

		await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
		await page.evaluate(() => navigator.clipboard.writeText('  cafe\u0301\n👩‍💻\t'));
		await page.keyboard.press('ControlOrMeta+v');
		assert.equal(await text.inputValue(), 'Привет мир  cafe\u0301\n👩‍💻\t');
		await expect(counts).toHaveText('Words: 3 Characters with spaces: 19');
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Backspace');
		await expect(counts).toHaveText('Words: 0 Characters with spaces: 0');
		assert.deepEqual((await messages(page)).map(message => message.type), ['ready', 'edit']);
	} finally { await page.close(); }
});

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
		await expect(page.locator('#document-counts')).toHaveText('Words: 2 Characters with spaces: 15');
		assert.equal(await page.locator('#conflict').isVisible(), true);
		assert.equal(await page.locator('#fontSize').inputValue(), '14');
		await page.locator('#useFile').click();
		assert.equal(await page.locator('#text').inputValue(), 'а)1\n\nб)3');
		await expect(page.locator('#document-counts')).toHaveText('Words: 4 Characters with spaces: 8');
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

test('Enter continues an indented numbered list and Undo uses the host document history', async () => {
	const page = await open();
	try {
		const text = page.locator('#text');
		const first = '\t  9) Первый пункт';
		const original = `Before\n${first}\nAfter`;
		await snapshot(page, { text: original, version: 2, dirty: false, name: 'List.txt' });
		const caret = 'Before\n'.length + first.length;
		await text.evaluate((el, offset) => el.setSelectionRange(offset, offset), caret);
		await text.press('Enter');
		const continued = `Before\n${first}\n\t  10) \nAfter`;
		assert.equal(await text.inputValue(), continued);
		assert.deepEqual(await text.evaluate(el => [el.selectionStart, el.selectionEnd]), [caret + 8, caret + 8]);

		const edits = (await messages(page)).filter(m => m.type === 'edit');
		assert.equal(edits.length, 1);
		assert.equal(edits[0].text, continued);
		await text.press('Control+z');
		assert.equal((await messages(page)).some(m => m.type === 'action'), false);
		await snapshot(page, { text: continued, version: 3, dirty: true, ack: edits[0].id, name: 'List.txt' });
		const action = (await messages(page)).find(m => m.type === 'action');
		assert.equal(action.action, 'undo');
		assert.equal(action.version, 3);
		await snapshot(page, { text: original, version: 4, dirty: false, name: 'List.txt' });
		assert.equal(await text.inputValue(), original);
	} finally { await page.close(); }
});

test('Cmd+Z and Cmd+Shift+Z dispatch once with the workbench key forwarder installed', async () => {
	const page = await open(undefined, true);
	try {
		const text = page.locator('#text');
		const original = '  9) Fresh check';
		const continued = original + '\n  10) ';
		const name = 'List.txt';
		await snapshot(page, { text: original, version: 2, dirty: false, name });
		await text.evaluate(el => el.setSelectionRange(el.value.length, el.value.length));
		await text.press('Enter');
		const edit = (await messages(page)).find(m => m.type === 'edit');
		assert.equal(edit.text, continued);
		await snapshot(page, { text: continued, version: 3, dirty: true, ack: edit.id, name });

		await text.press('Meta+z');
		assert.deepEqual((await messages(page)).filter(m => m.type === 'action').map(m => [m.action, m.version]), [['undo', 3]]);
		assert.equal((await messages(page)).some(m => m.type === 'forwardedHistoryKey'), false);
		await snapshot(page, { text: original, version: 4, dirty: false, name });
		await page.evaluate(() => window.postMessage({ type: 'actionDone' }, '*'));
		await page.waitForFunction(() => !document.querySelector('#text').readOnly);
		assert.equal(await text.inputValue(), original);
		assert.equal(await page.locator('#conflict').isVisible(), false);

		await text.press('Meta+Shift+z');
		assert.deepEqual((await messages(page)).filter(m => m.type === 'action').map(m => [m.action, m.version]), [['undo', 3], ['redo', 4]]);
		assert.equal((await messages(page)).some(m => m.type === 'forwardedHistoryKey'), false);
		await snapshot(page, { text: continued, version: 5, dirty: true, name });
		assert.equal(await text.inputValue(), continued);
		assert.equal(await page.locator('#conflict').isVisible(), false);
	} finally { await page.close(); }
});

test('Enter removes an empty list marker and keeps normal newline behavior elsewhere', async () => {
	const page = await open();
	try {
		const text = page.locator('#text');
		const cases = [
			{ value: '1) Item\n2) ', offset: '1) Item\n2) '.length, expected: '1) Item\n' },
			{ value: '  2)   \t', offset: 8, expected: '  ' },
			{ value: 'A paragraph', offset: 11, expected: 'A paragraph\n' },
			{ value: '2) Item', offset: 4, expected: '2) I\ntem' },
			{ value: '2)item', offset: 6, expected: '2)item\n' },
		];
		let version = 1;
		for (const { value, offset, expected } of cases) {
			await snapshot(page, { text: value, version: ++version, dirty: false, name: 'List.txt' });
			await text.evaluate((el, caret) => el.setSelectionRange(caret, caret), offset);
			await text.press('Enter');
			assert.equal(await text.inputValue(), expected);
			const edit = (await messages(page)).filter(m => m.type === 'edit').at(-1);
			assert.equal(edit.text, expected);
			await snapshot(page, { text: expected, version: ++version, dirty: true, ack: edit.id, name: 'List.txt' });
		}
	} finally { await page.close(); }
});

test('the new list item stays in view at the bottom of a long document', async () => {
	const page = await open();
	try {
		const text = page.locator('#text');
		const original = 'Paragraph\n'.repeat(100) + '1) Final item';
		await snapshot(page, { text: original, version: 2, dirty: false, name: 'List.txt' });
		await text.focus();
		await text.evaluate(el => {
			el.setSelectionRange(el.value.length, el.value.length);
			window.scrollTo(0, window.scrollY + el.getBoundingClientRect().bottom - window.innerHeight);
		});
		await text.press('Enter');
		assert.equal(await text.inputValue(), original + '\n2) ');
		assert.equal(await text.evaluate(el => el.getBoundingClientRect().bottom - window.innerHeight < parseFloat(getComputedStyle(el).lineHeight) / 2), true);
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
