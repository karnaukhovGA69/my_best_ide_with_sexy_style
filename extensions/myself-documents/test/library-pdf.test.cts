/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pdfCopyFile, readSelectedPdf, storePdfCopy } = require('../out/libraryPdf.js');

const id = '9c84d266-52dc-4b1f-8f98-2cbb106fc78b';
const file = pdfCopyFile(id);

test('PDF copy creation refuses an existing target, and rollback never deletes a replacement inode', async () => {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'myself-pdf-copy-')));
	try {
		const target = path.join(root, file);
		await fs.mkdir(path.dirname(target));
		await fs.writeFile(target, 'previous');
		await assert.rejects(storePdfCopy(root, file, Buffer.from('incoming'), () => false), { code: 'EEXIST' });
		assert.equal(await fs.readFile(target, 'utf8'), 'previous');

		await fs.unlink(target);
		const rollback = await storePdfCopy(root, file, Buffer.from('new copy'), () => false);
		await fs.rename(target, target + '.previous');
		await fs.writeFile(target, 'replacement');
		await assert.rejects(rollback(), /PDF copy changed/);
		assert.equal(await fs.readFile(target, 'utf8'), 'replacement');
		assert.equal(await fs.readFile(target + '.previous', 'utf8'), 'new copy');
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('PDF storage rejects a linked destination directory', async () => {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'myself-pdf-link-')));
	try {
		const other = path.join(root, 'other');
		await fs.mkdir(other);
		const storage = path.join(root, 'profile');
		await fs.mkdir(storage);
		await fs.symlink(other, path.join(storage, path.dirname(file)), 'dir');
		await assert.rejects(storePdfCopy(storage, file, Buffer.from('incoming'), () => false), /Invalid PDF storage directory/);
		assert.deepEqual(await fs.readdir(other), []);
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a selected PDF truncated while it is being read is rejected even if its header remains', async () => {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'myself-pdf-changed-')));
	const source = path.join(root, 'Selected.pdf');
	await fs.writeFile(source, '%PDF-1.7\nComplete original test bytes');
	const open = fs.open;
	fs.open = async (...args) => {
		const handle = await open(...args);
		if (args[0] === source) {
			const read = handle.read.bind(handle);
			handle.read = async (...readArgs) => {
				await fs.truncate(source, 12);
				return read(...readArgs);
			};
		}
		return handle;
	};
	try {
		await assert.rejects(readSelectedPdf(source), /Documentation file changed/);
	} finally {
		fs.open = open;
		await fs.rm(root, { recursive: true, force: true });
	}
});
