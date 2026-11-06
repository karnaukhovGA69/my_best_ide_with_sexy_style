/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RepositoryCatalog } = require('../out/repositoryCatalog.js');
const item = { id: 1, owner: { login: 'example' }, name: 'private-project', private: true, description: 'Local display', avatar_url: 'https://not-requested.invalid/avatar' };

test('loads private and public metadata from the fixed API with token only in headers', async () => {
	let calls = 0;
	const catalog = new RepositoryCatalog(async (url, options) => {
		calls++;
		assert.equal(new URL(url).origin, 'https://api.github.com');
		assert.equal(new URL(url).searchParams.get('page'), '2');
		assert.equal(String(url).includes('synthetic-token'), false);
		assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
		assert.equal(options.redirect, 'error');
		return Response.json([item, { ...item, id: 2, private: false }]);
	});
	const result = await catalog.page('synthetic-token', 2, new AbortController().signal);
	assert.deepEqual(result.repositories.map(r => r.private), [true, false]);
	assert.equal(result.hasMore, false);
	assert.equal(calls, 1);
	assert.equal('avatar_url' in result.repositories[0], false);
});

test('does not follow untrusted pagination links or fetch another page implicitly', async () => {
	let calls = 0;
	const catalog = new RepositoryCatalog(async () => { calls++; return Response.json(Array.from({ length: 100 }, (_, i) => ({ ...item, id: i + 1 })), { headers: { Link: '<https://attacker.invalid/>; rel="next"' } }); });
	assert.equal((await catalog.page('synthetic-token', 1, new AbortController().signal)).hasMore, true);
	assert.equal(calls, 1);
});

test('does not expose response text or credentials in authentication failures', async () => {
	const catalog = new RepositoryCatalog(async () => new Response('sensitive response body', { status: 401 }));
	await assert.rejects(catalog.page('synthetic-token', 1, new AbortController().signal), error => error.status === 401 && !String(error).includes('sensitive') && !String(error).includes('synthetic-token'));
});

test('rejects malformed identities and oversized payloads', async () => {
	for (const response of [Response.json([{ ...item, name: '../escape' }]), Response.json({ unexpected: true }), new Response('x'.repeat(4 * 1024 * 1024 + 1))]) {
		const catalog = new RepositoryCatalog(async () => response);
		await assert.rejects(catalog.page('synthetic-token', 1, new AbortController().signal), { status: 502 });
	}
});

test('cancelled and invalid requests do not use the network', async () => {
	const catalog = new RepositoryCatalog(async () => { throw new Error('Unexpected network'); });
	const controller = new AbortController(); controller.abort();
	await assert.rejects(catalog.page('synthetic-token', 1, controller.signal), { name: 'AbortError' });
	for (const page of [0, -1, 0.5, Infinity]) {
		await assert.rejects(catalog.page('synthetic-token', page, new AbortController().signal), /Invalid catalog request/);
	}
});
