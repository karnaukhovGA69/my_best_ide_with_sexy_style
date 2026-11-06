/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { getLocalResourceCsp } from '../src/preview/localResourceCsp.ts';

const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

describe('Markdown local resource policy', () => {
	for (const mode of ['preview', 'editor'] as const) {
		it(`${mode} blocks background external resources, preserves local content and manual links`, async () => {
			const externalRequests: string[] = [];
			const external = createServer((req, res) => {
				externalRequests.push(req.url!);
				res.end('manual destination');
			});
			external.listen(0, '127.0.0.1');
			await once(external, 'listening');
			const externalUrl = `http://127.0.0.1:${(external.address() as { port: number }).port}`;
			const localRequests: string[] = [];
			const local = createServer((req, res) => {
				localRequests.push(req.url!);
				if (req.url === '/pixel.png') {
					res.setHeader('Content-Type', 'image/png');
					res.end(Buffer.from(pixel, 'base64'));
				} else if (req.url === '/style.css') {
					res.setHeader('Content-Type', 'text/css');
					res.end(`@import url('${externalUrl}/import.css'); .local { color: rgb(1, 2, 3); background-image: url('${externalUrl}/background.png'); }`);
				} else {
					res.setHeader('Content-Type', 'text/html');
					res.end(`<!doctype html><meta http-equiv="Content-Security-Policy" content="${getLocalResourceCsp(localUrl, 'test-nonce', mode)}">
<script nonce="test-nonce">window.blocked=[];document.addEventListener('securitypolicyviolation',e=>window.blocked.push(e.blockedURI));</script>
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="${externalUrl}/external.css">
<style>@font-face {font-family: external; src: url('${externalUrl}/font.woff2')} .local {font-family:external}</style>
<p class="local">Local text</p><img id="local" src="/pixel.png"><img id="inline" src="data:image/png;base64,${pixel}">
<img src="${externalUrl}/image.png"><img srcset="${externalUrl}/srcset.png 1x"><video preload="auto" poster="${externalUrl}/poster.png" src="${externalUrl}/movie.webm"></video>
<a id="external" href="${externalUrl}/manual">Open link</a>`);
				}
			});
			local.listen(0, '127.0.0.1');
			await once(local, 'listening');
			const localUrl = `http://127.0.0.1:${(local.address() as { port: number }).port}`;
			let browser;
			try {
				const directives = getLocalResourceCsp('https://*.vscode-resource.vscode-cdn.net', 'nonce', mode).split(/\s+/);
				assert.ok(!directives.includes('https:') && !directives.includes('http:'));
				browser = await chromium.launch({ headless: true });
				const page = await browser.newPage();
				await page.goto(localUrl);
				await page.waitForFunction(() => {
					const local = document.querySelector('#local') as HTMLImageElement;
					const inline = document.querySelector('#inline') as HTMLImageElement;
					return local.complete && local.naturalWidth > 0 && inline.complete && inline.naturalWidth > 0;
				});
				assert.equal(await page.locator('.local').evaluate(e => getComputedStyle(e).color), 'rgb(1, 2, 3)');
				const blocked = await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked);
				assert.ok(blocked.some(url => url.includes('/image.png')));
				assert.ok(blocked.some(url => url.includes('/external.css')));
				assert.ok(blocked.some(url => url.includes('/movie.webm')));
				assert.ok(localRequests.includes('/style.css') && localRequests.includes('/pixel.png'));
				assert.deepEqual(externalRequests, []);
				await Promise.all([page.waitForURL(`${externalUrl}/manual`), page.locator('#external').click()]);
				assert.ok(externalRequests.includes('/manual'));
			} finally {
				await browser?.close();
				await Promise.all([new Promise<void>(resolve => local.close(() => resolve())), new Promise<void>(resolve => external.close(() => resolve()))]);
			}
		});
	}
});
