/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const bundle = await build({
	absWorkingDir: root,
	entryPoints: ['extensions/theme-nerded-calm/test/theme.test.ts'],
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: 'es2024',
	write: false,
	outfile: 'calm-resource-tests.js',
	tsconfig: path.join(root, 'src/tsconfig.json'),
	alias: { assert: path.join(root, 'test/unit/assert.js') },
	loader: { '.ttf': 'dataurl', '.svg': 'dataurl' },
});
const javascript = bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text;
const css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
const mocha = await readFile(require.resolve('mocha/mocha.js'));
const html = `<!doctype html><link rel="stylesheet" href="/bundle.css"><div id="mocha"></div>
<script src="/mocha.js"></script><script>
mocha.setup({ ui: 'tdd', timeout: 10000 });
globalThis._VSCODE_FILE_ROOT = location.origin + '/';
</script><script type="module">
import '/bundle.js';
const failures = [];
const runner = mocha.run(count => globalThis.testResult = { count, failures, tests: runner.stats.tests })
.on('fail', (test, error) => failures.push({ title: test.fullTitle(), error: error.stack }));
</script>`;
const server = createServer(async (request, response) => {
	try {
		const url = request.url ?? '/';
		const staticResources: Record<string, [string, string | Buffer]> = {
			'/': ['text/html', html],
			'/bundle.js': ['application/javascript', javascript],
			'/bundle.css': ['text/css', css],
			'/mocha.js': ['application/javascript', mocha],
		};
		const resource = staticResources[url];
		if (resource) {
			response.setHeader('Content-Type', resource[0]);
			response.end(resource[1]);
		} else if (/^\/extensions\/theme-nerded-calm\/(?:themes\/nerded-calm\.json|fileicons\/vscode-icons\.json|fileicons\/assets\/[\w+.-]+\.svg)$/.test(url)) {
			response.setHeader('Content-Type', url.endsWith('.svg') ? 'image/svg+xml' : 'application/json');
			response.end(await readFile(path.join(root, url)));
		} else {
			response.writeHead(404).end();
		}
	} catch {
		response.writeHead(500).end();
	}
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
	browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	const address = server.address();
	assert.ok(address && typeof address !== 'string');
	const origin = `http://127.0.0.1:${address.port}`;
	await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
	await page.goto(origin);
	await page.waitForFunction('globalThis.testResult !== undefined');
	const result = await page.evaluate('globalThis.testResult') as { count: number; failures: unknown[]; tests: number };
	console.log(JSON.stringify({ ...result, errors }, null, 2));
	assert.equal(result.tests, 4);
	assert.equal(result.count, 0);
	assert.deepEqual(errors, []);
} finally {
	await browser?.close();
	await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
