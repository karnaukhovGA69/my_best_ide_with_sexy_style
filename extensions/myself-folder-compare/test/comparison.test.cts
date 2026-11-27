/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const io = fs.promises;
const path = require('node:path');
const os = require('node:os');
const { compareFolders } = require('../out/comparison');

async function fixture(t) {
	const base = await io.realpath(await io.mkdtemp(path.join(os.tmpdir(), 'folder-compare-')));
	t.after(() => io.rm(base, { recursive: true, force: true }));
	const left = path.join(base, 'left');
	const right = path.join(base, 'right');
	await io.mkdir(left);
	await io.mkdir(right);
	const write = async (side, name, content) => {
		const target = path.join(side, name);
		await io.mkdir(path.dirname(target), { recursive: true });
		await io.writeFile(target, content);
	};
	return { base, left, right, write };
}

function adapter(overrides) {
	return Object.assign(Object.create(io), overrides);
}

function summary(result) {
	return result.entries.map(entry => [entry.path, entry.status, entry.reason]);
}

test('identical nested folders compare complete bytes without changes', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'nested/a.txt', 'hello');
	await f.write(f.right, 'nested/a.txt', 'hello');
	const result = await compareFolders(f.left, f.right);
	assert.deepEqual({ entries: result.entries, bytes: result.bytesRead, incomplete: result.incomplete }, { entries: [], bytes: 10, incomplete: false });
});

test('same size and mtime do not hide content changes', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', 'abcd');
	await f.write(f.right, 'a', 'abce');
	await io.utimes(path.join(f.left, 'a'), 1000, 1000);
	await io.utimes(path.join(f.right, 'a'), 1000, 1000);
	const result = await compareFolders(f.left, f.right);
	assert.deepEqual(result.entries.map(entry => [entry.path, entry.status, entry.original.toString(), entry.modified.toString()]), [['a', 'changed', 'abcd', 'abce']]);
});

test('additions, removals, empty directories and type conflicts use relative paths', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'removed', 'old');
	await f.write(f.right, 'added', 'new');
	await f.write(f.left, 'type', 'file');
	await io.mkdir(path.join(f.right, 'type'));
	await io.mkdir(path.join(f.right, 'empty'));
	assert.deepEqual(summary(await compareFolders(f.left, f.right)), [['added', 'added', undefined], ['empty', 'added', 'directory'], ['removed', 'removed', undefined], ['type', 'changed', 'type']]);
});

test('empty and binary files still compare actual bytes', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'empty', '');
	await f.write(f.right, 'empty', '');
	await f.write(f.right, 'new-empty', '');
	await f.write(f.left, 'binary', Buffer.from([0, 1]));
	await f.write(f.right, 'binary', Buffer.from([0, 2]));
	const result = await compareFolders(f.left, f.right);
	assert.deepEqual(summary(result), [['binary', 'changed', undefined], ['new-empty', 'added', undefined]]);
	assert.equal(result.entries[1].modified.length, 0);
});

test('static file, directory and cyclic links are skipped without target reads', async t => {
	const f = await fixture(t);
	const outside = path.join(f.base, 'outside');
	await io.mkdir(outside);
	await io.writeFile(path.join(outside, 'private'), 'fixture only');
	await io.symlink(path.join(outside, 'private'), path.join(f.left, 'file-link'));
	await io.symlink(outside, path.join(f.left, 'dir-link'));
	await io.symlink(f.left, path.join(f.left, 'loop'));
	let opened = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async () => { opened++; throw new Error('must not read'); } }) });
	assert.deepEqual({ entries: summary(result), incomplete: result.incomplete, opened }, { entries: [['dir-link', 'skipped', 'link'], ['file-link', 'skipped', 'link'], ['loop', 'skipped', 'link']], incomplete: true, opened: 0 });
});

test('selected root and ancestor symlinks are rejected before enumeration', async t => {
	const f = await fixture(t);
	const alias = path.join(f.base, 'alias');
	await io.symlink(f.left, alias);
	await io.mkdir(path.join(f.left, 'nested'));
	let opened = 0;
	const options = { io: adapter({ opendir: async () => { opened++; throw new Error('must not enumerate'); } }) };
	for (const selected of [alias, path.join(alias, 'nested')]) {
		assert.deepEqual(summary(await compareFolders(selected, f.right, options)), [['.', 'skipped', 'link']]);
	}
	assert.equal(opened, 0);
});

test('depth boundary is shown without opening its directory', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'nested/deeper/a', 'a');
	const opened = [];
	const result = await compareFolders(f.left, f.right, { limits: { depth: 1 }, io: adapter({ opendir: async (...args) => { opened.push(args[0]); return io.opendir(...args); } }) });
	assert.deepEqual({ entries: summary(result), opened }, { entries: [['nested', 'skipped', 'depth']], opened: [f.left, f.right] });
});

test('entry quota is shared across both trees and cannot imply absence', async t => {
	const f = await fixture(t);
	for (const name of ['a', 'b', 'c']) {
		await f.write(f.left, name, name);
	}
	const result = await compareFolders(f.left, f.right, { limits: { entries: 2 } });
	assert.deepEqual({ entries: summary(result), examined: result.examined, bytes: result.bytesRead }, { entries: [['.', 'skipped', 'entries']], examined: 2, bytes: 0 });
});

test('skipped links consume entry quota', async t => {
	const f = await fixture(t);
	for (const name of ['a', 'b', 'c']) {
		await io.symlink(f.left, path.join(f.left, name));
	}
	const result = await compareFolders(f.left, f.right, { limits: { entries: 2 } });
	assert.deepEqual({ examined: result.examined, entries: summary(result) }, { examined: 2, entries: [['.', 'skipped', 'entries']] });
});

test('file and aggregate byte limits refuse unread content', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	await f.write(f.right, 'a', '1234');
	const perFile = await compareFolders(f.left, f.right, { limits: { fileBytes: 3 } });
	const total = await compareFolders(f.left, f.right, { limits: { totalBytes: 6 } });
	assert.deepEqual([summary(perFile), perFile.bytesRead, summary(total), total.bytesRead], [[['a', 'skipped', 'fileBytes']], 0, [['a', 'skipped', 'totalBytes']], 4]);
});

test('an unreadable counterpart never becomes removal or empty snapshot', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', 'a');
	const result = await compareFolders(f.left, f.right, { io: adapter({ opendir: async (target, ...args) => {
		if (target === f.right) {
			throw Object.assign(new Error('fixture'), { code: 'EACCES' });
		}
		return io.opendir(target, ...args);
	} }) });
	assert.deepEqual(result.entries, [{ path: '.', status: 'skipped', reason: 'unreadable', code: 'EACCES' }]);
});

test('cancellation before start performs no I/O', async () => {
	let calls = 0;
	const result = await compareFolders('/left', '/right', { cancelled: () => true, io: adapter({ lstat: async () => { calls++; } }) });
	assert.deepEqual({ cancelled: result.cancelled, calls, entries: result.entries }, { cancelled: true, calls: 0, entries: [] });
});

test('cancellation while opening a directory closes the acquired handle', async t => {
	const f = await fixture(t);
	let cancelled = false;
	let closed = 0;
	const result = await compareFolders(f.left, f.right, { cancelled: () => cancelled, io: adapter({ opendir: async (...args) => {
		const handle = await io.opendir(...args);
		cancelled = true;
		return { read: () => { throw new Error('must not read'); }, close: async () => { closed++; await handle.close(); } };
	} }) });
	assert.deepEqual({ cancelled: result.cancelled, closed }, { cancelled: true, closed: 1 });
});

test('cancellation during file read closes the fd and exposes no snapshot', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	let cancelled = false;
	let closed = 0;
	const result = await compareFolders(f.left, f.right, { cancelled: () => cancelled, io: adapter({ open: async (...args) => {
		const handle = await io.open(...args);
		return { stat: options => handle.stat(options), read: async (...readArgs) => { const value = await handle.read(...readArgs); cancelled = true; return value; }, close: async () => { closed++; await handle.close(); } };
	} }) });
	assert.deepEqual({ cancelled: result.cancelled, bytes: result.bytesRead, closed, entries: result.entries }, { cancelled: true, bytes: 4, closed: 1, entries: [] });
});

test('growth during read discards content and closes the fd', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	let closed = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (...args) => {
		const handle = await io.open(...args);
		return { stat: options => handle.stat(options), read: async (...readArgs) => { const value = await handle.read(...readArgs); await io.appendFile(args[0], '5'); return value; }, close: async () => { closed++; await handle.close(); } };
	} }) });
	assert.deepEqual({ entries: summary(result), closed }, { entries: [['a', 'skipped', 'unstable']], closed: 1 });
});

test('size-preserving version change is detected using ctime, not mtime alone', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (...args) => {
		const handle = await io.open(...args);
		let count = 0;
		return { stat: async options => { const value = await handle.stat(options); return ++count === 1 ? value : Object.assign(Object.create(value), { ctimeNs: value.ctimeNs + 1n }); }, read: (...readArgs) => handle.read(...readArgs), close: () => handle.close() };
	} }) });
	assert.deepEqual(summary(result), [['a', 'skipped', 'unstable']]);
});

test('unexpected fd identity is rejected before any byte read', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	let reads = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (...args) => {
		const handle = await io.open(...args);
		return { stat: async options => { const value = await handle.stat(options); return Object.assign(Object.create(value), { ino: value.ino + 1n }); }, read: async () => { reads++; }, close: () => handle.close() };
	} }) });
	assert.deepEqual({ entries: summary(result), reads }, { entries: [['a', 'skipped', 'unstable']], reads: 0 });
});

test('regular-to-directory swap is refused before read', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	let reads = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (target, flags) => {
		await io.unlink(target);
		await io.mkdir(target);
		const handle = await io.open(target, flags);
		return { stat: options => handle.stat(options), read: async () => { reads++; }, close: () => handle.close() };
	} }) });
	assert.deepEqual({ entries: summary(result), reads }, { entries: [['a', 'skipped', 'unstable']], reads: 0 });
});

test('leaf symlink substitution at open is refused by O_NOFOLLOW', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	await f.write(f.right, 'outside', 'fixture');
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (target, flags) => {
		if (target === path.join(f.left, 'a')) {
			await io.unlink(target);
			await io.symlink(path.join(f.right, 'outside'), target);
		}
		return io.open(target, flags);
	} }) });
	assert.equal(result.entries.find(entry => entry.path === 'a').status, 'skipped');
});

test('deterministic ancestor substitution rejects a foreign fd without reading it', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'parent/a', 'inside');
	const outside = path.join(f.base, 'outside');
	await f.write(outside, 'a', 'outside fixture');
	let reads = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (target, flags) => {
		await io.rename(path.join(f.left, 'parent'), path.join(f.base, 'old-parent'));
		await io.symlink(outside, path.join(f.left, 'parent'));
		const handle = await io.open(target, flags);
		return { stat: options => handle.stat(options), read: async () => { reads++; }, close: () => handle.close() };
	} }) });
	assert.deepEqual({ entries: summary(result), reads }, { entries: [['parent', 'removed', 'directory'], ['parent/a', 'skipped', 'unstable']], reads: 0 });
});

test('canonical sibling-prefix escape is rejected before opening a file', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', 'a');
	let opens = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ realpath: async target => target === path.join(f.left, 'a') ? `${f.left}-sibling/a` : io.realpath(target), open: async () => { opens++; } }) });
	assert.deepEqual({ entries: summary(result), opens }, { entries: [['a', 'skipped', 'link']], opens: 0 });
});

test('file reads use nofollow, nonblocking and bounded chunks', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', Buffer.alloc(150000, 97));
	let chunks = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (target, flags) => {
		assert.equal(flags & fs.constants.O_NOFOLLOW, fs.constants.O_NOFOLLOW);
		assert.equal(flags & fs.constants.O_NONBLOCK, fs.constants.O_NONBLOCK);
		const handle = await io.open(target, flags);
		return { stat: options => handle.stat(options), read: async (...args) => { assert.ok(args[2] <= 65536); chunks++; return handle.read(...args); }, close: () => handle.close() };
	} }) });
	assert.deepEqual([chunks, result.bytesRead], [4, 150000]);
});

test('elapsed-time bound stops before the next operation', async t => {
	const f = await fixture(t);
	let clock = 0;
	const result = await compareFolders(f.left, f.right, { limits: { durationMs: 1 }, now: () => clock++, io: adapter({ lstat: async () => { throw new Error('must stop before I/O'); } }) });
	assert.deepEqual(summary(result), [['.', 'skipped', 'time']]);
});

test('a synthetic FIFO fd substitution is nonblocking and rejected before read', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	let reads = 0;
	let closed = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ open: async (target, flags) => {
		assert.equal(flags & fs.constants.O_NONBLOCK, fs.constants.O_NONBLOCK);
		const handle = await io.open(target, flags);
		return { stat: async options => Object.assign(Object.create(await handle.stat(options)), { isFile: () => false, isDirectory: () => false }), read: async () => { reads++; }, close: async () => { closed++; await handle.close(); } };
	} }) });
	assert.deepEqual({ entries: summary(result), reads, closed }, { entries: [['a', 'skipped', 'unstable']], reads: 0, closed: 1 });
});

test('directory substitution after open is detected before enumeration and handle is closed', async t => {
	const f = await fixture(t);
	let reads = 0;
	let closed = 0;
	const result = await compareFolders(f.left, f.right, { io: adapter({ opendir: async (target, options) => {
		const handle = await io.opendir(target, options);
		await io.rename(target, path.join(f.base, 'previous-left'));
		await io.mkdir(target);
		return { read: async () => { reads++; return handle.read(); }, close: async () => { closed++; await handle.close(); } };
	} }) });
	assert.deepEqual({ entries: summary(result), reads, closed }, { entries: [['.', 'skipped', 'unstable']], reads: 0, closed: 1 });
});

test('same roots and nested roots remain explicit bounded inputs', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', 'a');
	await f.write(f.left, 'nested/a', 'a');
	assert.deepEqual(summary(await compareFolders(f.left, f.left)), []);
	const nested = await compareFolders(f.left, path.join(f.left, 'nested'));
	assert.deepEqual(summary(nested), [['nested', 'removed', 'directory'], ['nested/a', 'removed', undefined]]);
});

test('invalid roots and upward overrides cannot expand read bounds', async () => {
	for (const value of ['relative', '//server/share', 'bad\0path']) {
		assert.deepEqual(summary(await compareFolders(value, '/right')), [['.', 'skipped', 'notLocal']]);
	}
	await assert.rejects(compareFolders('/left', '/right', { limits: { entries: 999999 } }), RangeError);
});

test('underreported size cannot turn unread differing contents into equality', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', 'left');
	await f.write(f.right, 'a', 'right');
	const zeroSize = value => Object.assign(Object.create(value), { size: 0n });
	const result = await compareFolders(f.left, f.right, { io: adapter({
		lstat: async (target, options) => { const value = await io.lstat(target, options); return value.isFile() ? zeroSize(value) : value; },
		open: async (...args) => {
			const handle = await io.open(...args);
			return { stat: async options => zeroSize(await handle.stat(options)), read: (...readArgs) => handle.read(...readArgs), close: () => handle.close() };
		}
	}) });
	assert.deepEqual(summary(result), [['a', 'skipped', 'unstable']]);
});

test('byte-boundary refusal reserves EOF evidence without exceeding either quota', async t => {
	const f = await fixture(t);
	await f.write(f.left, 'a', '1234');
	for (const limits of [{ fileBytes: 4 }, { totalBytes: 4 }]) {
		const result = await compareFolders(f.left, f.right, { limits });
		assert.deepEqual([result.bytesRead, result.incomplete, result.entries[0].status], [0, true, 'skipped']);
	}
});
