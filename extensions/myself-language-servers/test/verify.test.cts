/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const { test } = require('node:test');
const { PackageBusyError, PackageStore } = require('../out/store.js');

const darwinArm64 = process.platform === 'darwin' && process.arch === 'arm64';
const entrypoint = 'bin/server';
const readme = Buffer.from('synthetic server resources');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function executableHeader(cpu = 0x0100000c) {
	const header = Buffer.alloc(56);
	header.writeUInt32LE(0xfeedfacf, 0); // Mach-O 64
	header.writeUInt32LE(cpu, 4);
	header.writeUInt32LE(2, 12); // MH_EXECUTE
	header.writeUInt32LE(1, 16); // ncmds
	header.writeUInt32LE(24, 20); // sizeofcmds
	header.writeUInt32LE(0x80000028, 32); // LC_MAIN
	header.writeUInt32LE(24, 36);
	return header;
}

async function managedPackage(t, files = new Map([[entrypoint, executableHeader()], ['readme.txt', readme]])) {
	const storage = await fs.mkdtemp(join(tmpdir(), 'lsp-package-verification-'));
	t.after(() => fs.rm(storage, { recursive: true, force: true }));
	const id = randomUUID();
	const directory = join(storage, 'managed', id);
	const payload = join(directory, 'payload');
	const manifestPath = join(directory, 'package.json');
	await fs.mkdir(payload, { recursive: true, mode: 0o700 });
	for (const [relative, bytes] of files) {
		const path = join(payload, relative);
		await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
		await fs.writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
	}
	async function writeManifest(overrides = {}, original = files) {
		const tuples = [...original].map(([file, bytes]) => [file, bytes.length, hash(bytes)])
			.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
		const manifest = {
			schemaVersion: 1, id, entryRelative: entrypoint, treeSha256: hash(JSON.stringify(tuples)),
			archiveSha256: 'ab'.repeat(32), provenance: 'unverified', execution: 'requires-assessment',
			...overrides,
		};
		await fs.writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
	}
	await writeManifest();
	return { storage, id, directory, payload, manifestPath, writeManifest, store: new PackageStore(storage) };
}

test('verifies an intact v1 tuple digest and the exact Mach-O entry without rewriting the files', { skip: !darwinArm64 }, async t => {
	const files = new Map([['z.txt', readme], [entrypoint, executableHeader()], ['A.txt', Buffer.alloc(0)]]);
	const { id, payload, store, manifestPath } = await managedPackage(t, files);
	const manifest = await fs.readFile(manifestPath);
	await fs.mkdir(join(payload, 'empty'), { mode: 0o700 });
	assert.equal(await store.verify(id), 'verified');
	assert.deepEqual(await fs.readFile(manifestPath), manifest);
	for (const [relative, bytes] of files) {
		const file = join(payload, relative);
		assert.deepEqual(await fs.readFile(file), bytes);
		assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
	}
});

test('reports extra, missing and changed regular files as a tree mismatch', { skip: !darwinArm64 }, async t => {
	const { id, payload, store } = await managedPackage(t);
	const extra = join(payload, 'extra.txt');
	await fs.writeFile(extra, 'extra');
	assert.equal(await store.verify(id), 'tree-mismatch');
	await fs.unlink(extra);
	const resource = join(payload, 'readme.txt');
	await fs.writeFile(resource, Buffer.alloc(readme.length, 0x0a));
	assert.equal(await store.verify(id), 'tree-mismatch');
	await fs.unlink(resource);
	assert.equal(await store.verify(id), 'tree-mismatch');
});

test('rejects invalid schema, UUID, entry path and unexpected package layout', { skip: !darwinArm64 }, async t => {
	const { id, directory, manifestPath, store, writeManifest } = await managedPackage(t);
	for (const overrides of [{ schemaVersion: 2 }, { id: randomUUID() }, { entryRelative: '../server' }, { extra: true }]) {
		await writeManifest(overrides);
		assert.equal(await store.verify(id), 'invalid-manifest');
	}
	for (const invalid of ['{', Buffer.alloc(8193)]) {
		await fs.writeFile(manifestPath, invalid);
		assert.equal(await store.verify(id), 'invalid-manifest');
	}
	await writeManifest();
	await fs.writeFile(join(directory, 'extra.txt'), 'extra');
	assert.equal(await store.verify(id), 'unexpected-layout');
	assert.equal(await store.verify('../outside'), 'invalid-manifest');
});

test('checks the selected entry point and rejects a coherent digest for the wrong architecture', { skip: !darwinArm64 }, async t => {
	const { id, store, writeManifest } = await managedPackage(t, new Map([[entrypoint, executableHeader(0x01000007)]]));
	assert.equal(await store.verify(id), 'invalid-entrypoint');
	await writeManifest({ entryRelative: 'unlisted/server' });
	assert.equal(await store.verify(id), 'invalid-entrypoint');
});

test('rejects symlinks, hardlinks and special entries rather than hashing their targets', { skip: !darwinArm64 }, async t => {
	const { storage, id, payload, store } = await managedPackage(t);
	const resource = join(payload, 'readme.txt');
	const outside = join(storage, 'outside.txt');
	await fs.writeFile(outside, readme);
	await fs.unlink(resource);
	await fs.symlink(outside, resource);
	assert.equal(await store.verify(id), 'unsafe-entry');
	await fs.unlink(resource);
	await fs.link(outside, resource);
	assert.equal(await store.verify(id), 'unsafe-entry');
	await fs.unlink(resource);
	const folderLink = join(payload, 'link-folder');
	await fs.symlink(join(payload, 'bin'), folderLink);
	assert.equal(await store.verify(id), 'unsafe-entry');
	await fs.unlink(folderLink);
	execFileSync('/usr/bin/mkfifo', [resource]);
	assert.equal(await store.verify(id), 'unsafe-entry');
	assert.deepEqual(await fs.readFile(outside), readme);
});

test('reports read errors separately from limits and divergent checksums', { skip: !darwinArm64 }, async t => {
	const { id, payload, store } = await managedPackage(t);
	const resource = join(payload, 'readme.txt');
	await fs.chmod(resource, 0o000);
	assert.equal(await store.verify(id), 'unreadable');
	await fs.chmod(resource, 0o600);
	await fs.truncate(resource, 256 * 1024 * 1024 + 1);
	assert.equal(await store.verify(id), 'limits-exceeded');
});

test('fails unavailable if the v1 tree spelling differs and names allow normalization', { skip: !darwinArm64 }, async t => {
	const composed = 'caf\u00e9.txt';
	const files = new Map([[entrypoint, executableHeader()], [composed, readme]]);
	const { id, payload, store, writeManifest } = await managedPackage(t, files);
	const actual = (await fs.readdir(payload)).find(name => name.endsWith('.txt'));
	await writeManifest({}, new Map([[entrypoint, executableHeader()], [actual, readme]]));
	assert.equal(await store.verify(id), 'verified');
	const original = actual === composed ? composed.normalize('NFD') : composed;
	const originalNames = new Map([[entrypoint, executableHeader()], [original, readme]]);
	await writeManifest({}, originalNames);
	assert.equal(await store.verify(id), 'path-encoding');
});

test('serializes verification with removal and honors cancellation without holding a lease', { skip: !darwinArm64 }, async t => {
	const { storage, id, store } = await managedPackage(t);
	const secondWindow = new PackageStore(storage);
	const cancelled = AbortSignal.abort();
	await store.withPackageLease(id, async () => {
		assert.equal(await secondWindow.verify(id), 'busy');
		await assert.rejects(secondWindow.verify(id, cancelled), { name: 'AbortError' });
		await assert.rejects(secondWindow.remove(id), PackageBusyError);
	});
	assert.equal(await secondWindow.verify(id), 'verified');
	await store.remove(id);
	assert.equal(await secondWindow.verify(id), 'unreadable');
});

test('aborting between bounded reads closes the file and releases the package lease', { skip: !darwinArm64 }, async t => {
	const files = new Map([[entrypoint, executableHeader()], ['readme.txt', Buffer.alloc(128 * 1024)]]);
	const { storage, id, payload, store } = await managedPackage(t, files);
	const resource = join(payload, 'readme.txt');
	const cancellation = new AbortController();
	const originalOpen = fs.open;
	let reads = 0;
	let closed = false;
	t.mock.method(fs, 'open', async (path, ...options) => {
		const handle = await originalOpen(path, ...options);
		if (path === resource) {
			const read = handle.read.bind(handle);
			const close = handle.close.bind(handle);
			handle.read = async (...args) => {
				reads++;
				const result = await read(...args);
				cancellation.abort();
				return result;
			};
			handle.close = async () => {
				await close();
				closed = true;
			};
		}
		return handle;
	});
	await assert.rejects(store.verify(id, cancellation.signal), { name: 'AbortError' });
	assert.equal(reads, 1);
	assert.equal(closed, true);
	t.mock.restoreAll();
	assert.equal(await new PackageStore(storage).verify(id), 'verified');
});

test('reports a file changed after bytes were read even if the captured bytes still match', { skip: !darwinArm64 }, async t => {
	const { id, payload, store } = await managedPackage(t);
	const resource = join(payload, 'readme.txt');
	const originalOpen = fs.open;
	t.mock.method(fs, 'open', async (path, ...options) => {
		const handle = await originalOpen(path, ...options);
		if (path === resource) {
			const read = handle.read.bind(handle);
			handle.read = async (...args) => {
				const result = await read(...args);
				if (result.bytesRead === 0) {
					await fs.writeFile(resource, Buffer.alloc(readme.length, 0x0a));
				}
				return result;
			};
		}
		return handle;
	});
	assert.equal(await store.verify(id), 'changed');
});
