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
const { libraryHtml } = loadWithVscode('libraryView.js', viewApi);
let browser, server, origin;
const root = path.join(__dirname, '..');
before(async () => {
	server = http.createServer((request, response) => {
		if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(libraryHtml({ cspSource: origin, asWebviewUri: value => value.toString() }, uri(origin))); }
		else if (['/out/webview/library.js', '/media/library.css'].includes(request.url)) {
			response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(fs.readFileSync(path.join(root, request.url)));
		} else { response.writeHead(404); response.end(); }
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
	browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
async function open(viewport = { width: 1100, height: 800 }) {
	const page = await browser.newPage({ viewport });
	const external = [], errors = [];
	await page.route('https://**/*', route => { external.push(route.request().url()); return route.abort(); });
	page.on('pageerror', error => errors.push(error.message));
	await page.addInitScript(() => { window.messages = []; window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message) }); });
	await page.goto(origin); await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'));
	return { page, external, errors };
}
async function show(page, text, extra = {}) {
	await page.evaluate(message => window.postMessage(message, '*'), { type: 'document', title: 'Fixture', metadata: 'Offline', notice: 'Local copy', source: true, back: true, format: 'html', text, ...extra });
	await page.waitForFunction(() => document.getElementById('title').textContent !== '');
}

test('untrusted HTML cannot execute code, load resources, navigate, submit forms or replace controls', async () => {
	const { page, external, errors } = await open();
	try {
		await show(page, `<meta http-equiv="refresh" content="0;url=https://blocked.invalid/refresh"><script>window.compromised=true</script><style>@import 'https://blocked.invalid/css';</style><link rel="stylesheet" href="https://blocked.invalid/link"><iframe src="https://blocked.invalid/frame"></iframe><object data="https://blocked.invalid/object"></object><img src="https://blocked.invalid/image" srcset="https://blocked.invalid/other 2x" onerror="window.compromised=true" alt="Diagram"><video src="https://blocked.invalid/video" poster="https://blocked.invalid/poster"></video><svg><image href="https://blocked.invalid/svg"/></svg><form action="https://blocked.invalid/post"><input autofocus></form><h1 id="source" style="background:url(https://blocked.invalid/background)">Heading</h1><p onclick="window.compromised=true">Readable</p><pre><code>echo &lt;hello&gt;</code></pre>`);
		await page.waitForTimeout(100);
		assert.deepEqual(await page.evaluate(() => ({ compromised: !!window.compromised, controls: document.querySelectorAll('#source').length, unsafe: document.querySelectorAll('#document script, #document iframe, #document img, #document form, #document [style], #document [onclick]').length, code: document.querySelector('#document code').textContent })),
			{ compromised: false, controls: 1, unsafe: 0, code: 'echo <hello>' });
		assert.deepEqual(external, []); assert.deepEqual(errors, []); assert.equal(page.url(), origin + '/');
	} finally { await page.close(); }
});

test('contents and links work without opening a browser automatically; TXT stays literal', async () => {
	const { page, external } = await open();
	try {
		await show(page, '<h1 id="intro">Intro</h1><a href="#details">Jump</a><h2 id="details">Details</h2><a href="next.html">Next</a>');
		assert.equal(await page.locator('#contents option').count(), 2);
		await page.getByRole('link', { name: 'Jump' }).click();
		await page.getByRole('link', { name: 'Next' }).click();
		await page.locator('#source').click();
		assert.deepEqual(await page.evaluate(() => window.messages.filter(m => m.type !== 'ready')), [{ type: 'link', href: 'next.html' }, { type: 'source' }]);
		await show(page, '# Notes\n<script>bad()</script>', { format: 'text', title: 'Text' });
		await page.waitForFunction(() => document.getElementById('title').textContent === 'Text');
		assert.equal(await page.locator('#document pre').textContent(), '# Notes\n<script>bad()</script>'); assert.deepEqual(external, []);
	} finally { await page.close(); }
});

test('Find works in a narrow reader and does not overflow the sidebar', async () => {
	const { page, errors } = await open({ width: 270, height: 450 });
	try {
		await show(page, '<p>Two <em>words</em> in the document.</p>'.repeat(100), { title: 'A documentation article with a long title' });
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		const query = page.getByRole('searchbox');
		await page.keyboard.press('Meta+f');
		assert.equal(await query.evaluate(node => document.activeElement === node), true);
		await query.fill('Two words');
		await query.press('Enter');
		assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Two words');
		const firstMatch = await page.evaluate(() => window.getSelection().anchorNode.parentElement.closest('p').previousElementSibling === null);
		assert.equal(firstMatch, true);
		await page.getByRole('button', { name: 'Next Match' }).click();
		assert.equal(await page.evaluate(() => window.getSelection().anchorNode.parentElement.closest('p').previousElementSibling !== null), true);
		assert.equal(await page.locator('#find-status').isVisible(), false);
		await query.fill('not found in the article');
		await query.press('Enter');
		assert.equal(await page.locator('#find-status').textContent(), 'No matches found.');
		assert.equal(await page.locator('#find-status').isVisible(), true);
		assert.deepEqual(errors, []);
	} finally { await page.close(); }
});

test('all five official sets render readable offline content with no external requests', async () => {
	const catalog = JSON.parse(fs.readFileSync(path.join(root, 'documentation/catalog.json'), 'utf8'));
	const files = ['go/go-spec.html', 'rust/rust-reference.html', 'postgresql/index.html', 'bash/bash.html', 'linux/open.2.html'];
	const { page, external, errors } = await open();
	try {
		for (const file of files) {
			const entry = catalog.entries.find(entry => entry.file === file); assert.ok(entry, file);
			await show(page, fs.readFileSync(path.join(root, 'documentation', file), 'utf8'), { selector: entry.selector, title: entry.title });
			await page.waitForFunction(title => document.getElementById('title').textContent === title, entry.title);
			assert.ok((await page.locator('#document').textContent()).length > 1000, file);
		}
		assert.deepEqual(external, []); assert.deepEqual(errors, []);
	} finally { await page.close(); }
});


test('Markdown renders headings, lists, tables and code with local contents and inert resources', async () => {
	const { page, external, errors } = await open();
	try {
		const markdown = [
			'# Guide', '', '[Jump](#привет-мир)', '', '## Привет мир', '', '**Bold** and *emphasis*', '',
			'- First', '- Second', '', '| Name | Value |', '| --- | --- |', '| Local | Yes |', '',
			'```js', '<script>literal()</script>', '```', '', '## Привет мир', '',
			'![Diagram](https://blocked.invalid/image)', '', '[Next](next.md)', '',
			'<script>window.compromised=true</script>', '<iframe src="https://blocked.invalid/frame"></iframe>',
			'<img src="https://blocked.invalid/inline" onerror="window.compromised=true">',
			'<style>@import "https://blocked.invalid/style";</style>',
		].join('\n');
		await show(page, markdown, { format: 'markdown' });
		assert.equal(await page.locator('#document h1').textContent(), 'Guide');
		assert.deepEqual(await page.locator('#document h2').evaluateAll(nodes => nodes.map(n => n.id)), ['doc-привет-мир', 'doc-привет-мир-1']);
		assert.equal(await page.locator('#contents option').count(), 3);
		assert.equal(await page.locator('#document strong').textContent(), 'Bold');
		assert.equal(await page.locator('#document li').count(), 2);
		assert.equal(await page.locator('#document td').count(), 2);
		assert.equal((await page.locator('#document pre code').textContent()).trim(), '<script>literal()</script>');
		assert.equal(await page.locator('#document .image-description').textContent(), '[Diagram]');
		await page.getByRole('link', { name: 'Jump', exact: true }).click();
		await page.getByRole('link', { name: 'Next', exact: true }).click();
		assert.deepEqual(await page.evaluate(() => window.messages.filter(m => m.type !== 'ready')), [{ type: 'link', href: 'next.md' }]);
		assert.equal(await page.locator('#document script, #document img, #document iframe, #document style, #document [onerror]').count(), 0);
		assert.equal(await page.evaluate(() => !!window.compromised), false);
		assert.deepEqual(external, []); assert.deepEqual(errors, []);
	} finally { await page.close(); }
});
