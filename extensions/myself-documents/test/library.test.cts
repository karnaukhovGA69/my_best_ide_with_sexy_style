/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseCatalog, findLocalLink, maxDocumentBytes } = require('../out/libraryModel.js');
const root = path.join(__dirname, '..', 'documentation');

test('documentation snapshot has five complete catalogs, intact readable files and license notices', () => {
	const catalog = parseCatalog(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
	assert.deepEqual(catalog.groups.map(group => group.id), ['go', 'rust', 'postgresql', 'bash', 'linux']);
	for (const group of catalog.groups) { assert.ok(catalog.entries.some(entry => entry.group === group.id)); }
	for (const entry of catalog.entries) {
		const bytes = fs.readFileSync(path.join(root, entry.file));
		assert.ok(bytes.length > 0 && bytes.length <= maxDocumentBytes, entry.file);
		assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
		assert.ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes).length > 0);
	}
	assert.ok(fs.existsSync(path.join(root, 'postgresql/legalnotice.html')));
	assert.match(fs.readFileSync(path.join(root, 'bash/bash.html'), 'utf8'), /GNU Free Documentation License/);
	assert.ok(fs.existsSync(path.join(root, 'licenses/linux-man-pages-6.20.tar.gz')));
});

test('catalog rejects traversal, duplicate identities and unsupported content', () => {
	const make = file => ({ groups: [{ id: 'test', title: 'Test', version: '1', license: 'MIT' }], entries: [{ id: 'one', group: 'test', title: 'Page', file, source: '', format: 'html' }] });
	for (const file of ['../secret', '/secret', 'group/../../secret', 'C:\\secret', 'group\\secret', 'group//file']) {
		assert.throws(() => parseCatalog(JSON.stringify(make(file))));
	}
	const duplicate = make('test/page.html'); duplicate.entries.push(duplicate.entries[0]);
	assert.throws(() => parseCatalog(JSON.stringify(duplicate)));
});

test('offline navigation resolves relative and original links but never arbitrary files or commands', () => {
	const first = { id: 'one', group: 'test', file: 'test/index.html', source: 'https://example.invalid/docs/index.html' };
	const second = { id: 'two', group: 'test', file: 'test/page.html', source: 'https://example.invalid/docs/page.html' };
	for (const href of ['page.html#section', 'https://example.invalid/docs/page.html#section']) {
		assert.deepEqual(findLocalLink(first, href, [first, second]), { entry: second, fragment: 'section' });
	}
	assert.deepEqual(findLocalLink(first, '#intro', [first]), { entry: first, fragment: 'intro' });
	for (const href of ['file:///etc/passwd', 'command:workbench.action.terminal.new', 'javascript:alert(1)', 'https://elsewhere.invalid/docs/page.html', '../../secret']) {
		assert.equal(findLocalLink(first, href, [first, second]), undefined);
	}
});
