/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { readDocumentationFolder, folderImportLimits } = require('../out/libraryImport.js');
const { findLocalLink } = require('../out/libraryModel.js');

test('folder scanning preserves Unicode paths, skips symlinks and never follows document resources', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'library-scan-'));
	try {
		await fs.mkdir(path.join(root, 'docs')); await fs.mkdir(path.join(root, 'outside'));
		await fs.writeFile(path.join(root, 'outside/secret.txt'), 'outside');
		await fs.writeFile(path.join(root, 'docs/Привет #1.md'), '# Guide\n![remote](https://example.invalid/image)');
		await fs.writeFile(path.join(root, 'docs/image.png'), Buffer.from([255]));
		await fs.symlink(path.join(root, 'outside'), path.join(root, 'docs/escape'));
		await fs.symlink(path.join(root, 'outside/secret.txt'), path.join(root, 'docs/link.txt'));
		const documents = await readDocumentationFolder(path.join(root, 'docs'), () => false);
		assert.deepEqual(documents.map(d => d.relative), ['Привет #1.md']);
		assert.match(new TextDecoder().decode(documents[0].bytes), /remote/);
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('folder scanning fails before import for invalid UTF-8, cancellation and bounded counts/bytes', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'library-limits-'));
	try {
		await fs.writeFile(path.join(root, 'one.md'), '# One');
		for (const limits of [{ documents: 0 }, { entries: 0 }, { bytes: 2 }]) {
			await assert.rejects(readDocumentationFolder(root, () => false, { ...folderImportLimits, ...limits }));
		}
		await assert.rejects(readDocumentationFolder(root, () => true), /Cancelled/);
		await fs.writeFile(path.join(root, 'bad.txt'), Buffer.from([255]));
		await assert.rejects(readDocumentationFolder(root, () => false));
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('set links resolve encoded nested paths and cannot cross into another import or filesystem', () => {
	const entry = (id, collection, importPath) => ({ id, group: 'imported', collection, importPath, file: 'imports/' + id + '.md', source: '' });
	const first = entry('one', 'a', 'chapters/start.md'), next = entry('two', 'a', 'Привет #1.md'), other = entry('three', 'b', 'secret.md');
	const entries = [first, next, other];
	assert.deepEqual(findLocalLink(first, '../%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82%20%231.md#intro', entries), { entry: next, fragment: 'intro' });
	for (const href of ['../secret.md', '../../etc/passwd', 'file:///etc/passwd', 'command:test', 'https://library.invalid/Привет%20%231.md', '//server/share', '..\\secret.md']) {
		assert.equal(findLocalLink(first, href, entries), undefined, href);
	}
});
