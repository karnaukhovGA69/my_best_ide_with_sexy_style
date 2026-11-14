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

test('documentation snapshot has five complete sets, intact UTF-8 files and license notices', () => {
	const catalog = parseCatalog(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
	const foldedPaths = catalog.entries.map(entry => entry.file.toLowerCase());
	assert.equal(new Set(foldedPaths).size, foldedPaths.length, 'portable filenames must not differ only by case');
	assert.deepEqual(catalog.groups.map(group => group.id), ['go', 'rust', 'postgresql', 'bash', 'linux']);
	for (const group of catalog.groups) {
		assert.ok(catalog.entries.some(entry => entry.group === group.id));
	}
	const namesByDirectory = new Map();
	const decoder = new TextDecoder('utf-8', { fatal: true });
	for (const entry of catalog.entries) {
		let file = root;
		for (const component of entry.file.split('/')) {
			let names = namesByDirectory.get(file);
			if (!names) {
				names = new Set(fs.readdirSync(file));
				namesByDirectory.set(file, names);
			}
			assert.ok(names.has(component), `Incorrect path component ${component} in ${entry.file}`);
			file = path.join(file, component);
		}
		const bytes = fs.readFileSync(file);
		assert.ok(bytes.length > 0 && bytes.length <= maxDocumentBytes, entry.file);
		assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
		assert.ok(decoder.decode(bytes).length > 0, entry.file);
	}
	assert.ok(fs.existsSync(path.join(root, 'postgresql/legalnotice.html')));
	assert.match(fs.readFileSync(path.join(root, 'bash/bash.html'), 'utf8'), /GNU Free Documentation License/);
	assert.ok(fs.existsSync(path.join(root, 'licenses/linux-man-pages-6.20.tar.gz')));
});

test('catalog rejects traversal, duplicate identities and unsupported content', () => {
	const make = file => ({ groups: [{ id: 'test', title: 'Test', version: '1', license: 'MIT' }], entries: [{ id: 'one', group: 'test', title: 'Page', file, source: '', format: 'html' }] });
	assert.equal(parseCatalog(JSON.stringify(make('test/page.html'))).entries.length, 1);
	for (const file of ['../secret', '/secret', 'group/../../secret', 'C:\\secret', 'group\\secret', 'group//file']) {
		assert.throws(() => parseCatalog(JSON.stringify(make(file))), { message: 'Invalid documentation entry' }, file);
	}
	const duplicate = make('test/page.html');
	duplicate.entries.push({ ...duplicate.entries[0], file: 'test/other.html' });
	assert.throws(() => parseCatalog(JSON.stringify(duplicate)), { message: 'Invalid documentation entry' });
	const unsupported = make('test/page.html');
	unsupported.entries[0].format = 'pdf';
	assert.throws(() => parseCatalog(JSON.stringify(unsupported)), { message: 'Invalid documentation entry' });
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

test('case-distinct Linux manpages retain distinct original content and offline links', () => {
	const catalog = parseCatalog(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
	const page = name => catalog.entries.find(entry => entry.id === 'linux/' + name + '.3.html');
	const macro = page('NAN'), functionPage = page('nan');
	const macroHtml = fs.readFileSync(path.join(root, macro.file), 'utf8');
	const functionHtml = fs.readFileSync(path.join(root, functionPage.file), 'utf8');
	assert.notEqual(macroHtml, functionHtml);
	assert.match(macroHtml, /INFINITY/);
	assert.match(functionHtml, /nanf/);
	assert.deepEqual(findLocalLink(macro, functionPage.source, catalog.entries), { entry: functionPage, fragment: '' });
	for (const name of ['_Exit', '_exit']) {
		assert.match(fs.readFileSync(path.join(root, page(name).file), 'utf8'), /SYNOPSIS/);
	}
});
