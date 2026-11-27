/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { execFile, spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { test, after } = require('node:test');
const { promisify } = require('node:util');
const { ZipFile } = require('yazl');
const { PackageBusyError, PackageStore } = require('../out/store.js');

const darwinArm64 = process.platform === 'darwin' && process.arch === 'arm64';
const execFileAsync = promisify(execFile);
const readme = Buffer.from('fixture resource\n');
const entry = 'server/bin/test-server';
const resource = 'server/resources/readme.txt';

async function temp(t) {
	const root = await fs.mkdtemp(join(tmpdir(), 'lsp-archive-test-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	return root;
}

async function makeZip(file, entries) {
	const zip = new ZipFile();
	for (const [name, bytes, mode] of entries) {
		if (bytes === undefined) {
			zip.addEmptyDirectory(name);
		} else {
			zip.addBuffer(bytes, name, { compress: false, mode });
		}
	}
	zip.end();
	await pipeline(zip.outputStream, createWriteStream(file));
}

async function nestZip(file, binary) {
	await makeZip(file, [['server/'], [entry, binary, 0o100777], [resource, readme, 0o100777]]);
}

let fixture;
async function testBinary() {
	if (!fixture) {
		fixture = await fs.mkdtemp(join(tmpdir(), 'lsp-native-fixture-'));
		const source = join(fixture, 'main.c');
		const output = join(fixture, 'server');
		await fs.writeFile(source, '#include <stdio.h>\nint main(void) { FILE *marker = fopen("lsp-fixture-ran", "w"); if (marker) fclose(marker); return 0; }\n');
		await execFileAsync('/usr/bin/clang', ['-arch', 'arm64', source, '-o', output]);
	}
	return fs.readFile(join(fixture, 'server'));
}
after(async () => {
	if (fixture) {
		await fs.rm(fixture, { recursive: true, force: true });
	}
});

const selectFirst = async preview => preview.entrypoints[0];
const isLock = name => /^\.(?:imports|package-[0-9a-f-]+)\.lock$/.test(name);
const managedContents = async storage => (await fs.readdir(join(storage, 'managed'))).filter(name => !isLock(name));

test('publishes the inspected Mach-O and its resource atomically, then removes only the UUID copy', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	const binary = await testBinary();
	await nestZip(zip, binary);
	const archiveSha256 = createHash('sha256').update(await fs.readFile(zip)).digest('hex');
	const store = new PackageStore(storage);
	const secondWindow = new PackageStore(storage);
	const installed = await store.importZip(zip, async preview => {
		assert.deepEqual(preview, { archiveSha256, entrypoints: [entry] });
		assert.deepEqual(await secondWindow.list(), []);
		return entry;
	});
	assert.equal(installed.archiveSha256, archiveSha256);
	assert.equal(installed.entryRelative, entry);
	assert.equal(installed.provenance, 'unverified');
	assert.equal(installed.execution, 'requires-assessment');
	const payload = join(storage, 'managed', installed.id, 'payload');
	const files = [[entry, binary], [resource, readme]];
	const tuples = files.map(([name, bytes]) => [name, bytes.length, createHash('sha256').update(bytes).digest('hex')]);
	assert.equal(installed.treeSha256, createHash('sha256').update(JSON.stringify(tuples)).digest('hex'));
	for (const [name, bytes] of files) {
		assert.deepEqual(await fs.readFile(join(payload, name)), bytes);
		assert.equal((await fs.stat(join(payload, name))).mode & 0o777, 0o600);
	}
	assert.equal((await fs.stat(payload)).mode & 0o777, 0o700);
	assert.deepEqual(await secondWindow.list(), [installed]);
	assert.deepEqual(await managedContents(storage), [installed.id]);

	const second = await secondWindow.importZip(zip, selectFirst);
	assert.notEqual(second.id, installed.id);
	const removals = await Promise.allSettled([store.remove(installed.id), secondWindow.remove(installed.id)]);
	assert.ok(removals.some(result => result.status === 'fulfilled'));
	assert.ok(removals.every(result => result.status === 'fulfilled' || result.reason instanceof PackageBusyError));
	await secondWindow.remove(installed.id);
	assert.deepEqual(await store.list(), [second]);
	assert.deepEqual(await managedContents(storage), [second.id]);
	assert.equal(createHash('sha256').update(await fs.readFile(zip)).digest('hex'), archiveSha256);
});

test('inspection and commit use the same snapshot; cancellation or invalid selection preserves earlier installs', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	const binary = await testBinary();
	await nestZip(zip, binary);
	const store = new PackageStore(storage);
	const installed = await store.importZip(zip, async preview => {
		await fs.writeFile(zip, 'changed after inspection');
		return selectFirst(preview);
	});
	assert.deepEqual(await fs.readFile(join(storage, 'managed', installed.id, 'payload', entry)), binary);
	await nestZip(zip, binary);
	assert.equal(await store.importZip(zip, async () => undefined), undefined);
	const cancel = new AbortController();
	await assert.rejects(store.importZip(zip, async preview => {
		cancel.abort();
		return selectFirst(preview);
	}, cancel.signal), { name: 'AbortError' });
	await assert.rejects(store.importZip(zip, async () => '../outside'), /select an executable/i);
	assert.deepEqual(await managedContents(storage), [installed.id]);
});

function patchNames(archive, name, replacement, localOnly = false) {
	const from = Buffer.from(name);
	const to = Buffer.from(replacement);
	assert.equal(from.length, to.length);
	const first = archive.indexOf(from);
	assert.ok(first >= 0);
	to.copy(archive, first);
	if (!localOnly) {
		const second = archive.indexOf(from, first + from.length);
		assert.ok(second > first);
		to.copy(archive, second);
	}
}

test('checks the CRC, sizes and bounds of streamed deflate descriptors', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	const binary = await testBinary();
	const archive = new ZipFile();
	archive.addReadStream(Readable.from([binary]), entry);
	archive.addBuffer(readme, resource, { compress: false });
	archive.end();
	await pipeline(archive.outputStream, createWriteStream(zip));

	const original = await fs.readFile(zip);
	const eocd = original.length - 22;
	const central = original.readUInt32LE(eocd + 16);
	const nextCentralRecord = central + 46 + original.readUInt16LE(central + 28)
		+ original.readUInt16LE(central + 30) + original.readUInt16LE(central + 32);
	const nextLocalHeader = original.readUInt32LE(nextCentralRecord + 42);
	const descriptor = nextLocalHeader - 16;
	assert.equal(original.readUInt32LE(descriptor), 0x08074b50);
	const store = new PackageStore(storage);
	const signed = await store.importZip(zip, selectFirst);
	assert.equal(signed.entryRelative, entry);

	// Remove the optional signature and adjust the two displaced offsets.
	const unsigned = Buffer.concat([original.subarray(0, descriptor), original.subarray(descriptor + 4)]);
	unsigned.writeUInt32LE(central - 4, eocd + 16 - 4);
	unsigned.writeUInt32LE(nextLocalHeader - 4, nextCentralRecord + 42 - 4);
	await fs.writeFile(zip, unsigned);
	assert.equal((await store.importZip(zip, selectFirst)).entryRelative, entry);
	const before = await store.list();

	for (const [field, offset] of [['CRC', 4], ['compressed size', 8], ['uncompressed size', 12]]) {
		await t.test(`rejects descriptor with altered ${field}`, async () => {
			const tampered = Buffer.from(original);
			tampered[descriptor + offset] ^= 1;
			await fs.writeFile(zip, tampered);
			await assert.rejects(store.importZip(zip, async () => assert.fail('invalid ZIP reached selection')), /data descriptor/i);
		});
	}
	const truncated = Buffer.concat([original.subarray(0, descriptor + 8), original.subarray(nextLocalHeader)]);
	truncated.writeUInt32LE(central - 8, eocd + 16 - 8);
	truncated.writeUInt32LE(nextLocalHeader - 8, nextCentralRecord + 42 - 8);
	await fs.writeFile(zip, truncated);
	await assert.rejects(store.importZip(zip, async () => assert.fail('truncated ZIP reached selection')), /data descriptor/i);
	assert.deepEqual(await store.list(), before);
	assert.equal((await managedContents(storage)).length, before.length);
});

test('rejects hostile ZIP paths, types, metadata and payloads before publication', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	const binary = await testBinary();
	const store = new PackageStore(storage);
	const baseline = await makeZip(zip, [[entry, binary], ['safe.txt', readme]]);
	assert.equal(baseline, undefined);
	const original = await fs.readFile(zip);
	const outside = join(root, 'escape');
	await fs.writeFile(outside, 'outside stays intact');
	const cases = [
		['path traversal', data => patchNames(data, 'safe.txt', '../escape'.slice(0, 8))],
		['absolute path', data => patchNames(data, 'safe.txt', '/bad.txt')],
		['DOS drive', data => patchNames(data, 'safe.txt', 'C:/x.txt')],
		['backslash', data => patchNames(data, 'safe.txt', 'a\\b.html')],
		['device', data => patchNames(data, 'safe.txt', 'NUL.html')],
		['stream', data => patchNames(data, 'safe.txt', 'a:bb.txt')],
		['header mismatch', data => patchNames(data, 'safe.txt', 'else.txt', true)],
		['CRC mismatch', data => { data[data.indexOf(readme)] ^= 1; }],
		['encrypted', data => { data.writeUInt16LE(data.readUInt16LE(6) | 1, 6); }],
		['oversized entry', data => {
			const record = data.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
			data.writeUInt32LE(512 * 1024 * 1024, record + 20);
			data.writeUInt32LE(512 * 1024 * 1024, record + 24);
		}],
		['too many entries', data => {
			const end = data.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
			data.writeUInt16LE(4097, end + 10);
		}],
	];
	for (const [name, patch] of cases) {
		await t.test(name, async () => {
			const edition = Buffer.from(original);
			patch(edition);
			await fs.writeFile(zip, edition);
			await assert.rejects(store.importZip(zip, async () => assert.fail('invalid ZIP reached selection')));
			assert.deepEqual(await managedContents(storage), []);
		});
	}

	for (const [name, entries] of [
		['symlink', [['link', Buffer.from('../escape'), 0o120777]]],
		['fifo', [['pipe', Buffer.from(''), 0o010600]]],
		['case conflict', [['Dir/a', readme], ['dir/b', readme]]],
		['Unicode conflict', [['Café/a', readme], ['Cafe\u0301/b', readme]]],
		['file and subtree', [['a', readme], ['a/b', readme]]],
		['duplicate name', [['twice', readme], ['twice', readme]]],
		['excessive depth', [[Array(17).fill('x').join('/'), readme]]],
		['no native binary', [['run.sh', Buffer.from('#!/bin/sh\nexit 1'), 0o100755]]],
	]) {
		await t.test(name, async () => {
			await makeZip(zip, name === 'no native binary' ? entries : [[entry, binary], ...entries]);
			await assert.rejects(store.importZip(zip, async () => assert.fail('invalid ZIP reached selection')));
			assert.deepEqual(await managedContents(storage), []);
		});
	}
	assert.equal(await fs.readFile(outside, 'utf8'), 'outside stays intact');
});

test('ignores uncommitted and malformed folders and retries removal after a restart', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	await nestZip(zip, await testBinary());
	const store = new PackageStore(storage);
	const install = await store.importZip(zip, selectFirst);
	const managed = join(storage, 'managed');
	const outside = join(root, 'outside');
	const forged = randomUUID();
	await fs.mkdir(outside);
	await fs.writeFile(join(outside, 'marker'), 'unrelated');
	await fs.symlink(outside, join(managed, forged));
	await assert.rejects(store.remove(forged), /valid managed package/);
	await assert.rejects(store.remove('../outside'), /invalid managed package ID/i);
	await fs.rename(join(managed, install.id), join(managed, '.removed-' + install.id));
	const restarted = new PackageStore(storage);
	assert.deepEqual(await restarted.list(), []);
	await restarted.cleanup();
	assert.deepEqual(await managedContents(storage), [forged]);
	assert.equal(await fs.readFile(join(outside, 'marker'), 'utf8'), 'unrelated');
});

test('Refresh leaves a live import alone and recovers its staging after SIGKILL', { skip: !darwinArm64, timeout: 5000 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	await nestZip(zip, await testBinary());
	const store = new PackageStore(storage);
	const installed = await store.importZip(zip, selectFirst);
	const managed = join(storage, 'managed');
	const legacy = join(managed, '.import-legacy');
	await fs.mkdir(legacy, { mode: 0o700 });
	await fs.writeFile(join(legacy, 'keep'), 'legacy');
	const child = spawn(process.execPath, ['-e', `
		const { PackageStore } = require(process.argv[1]);
		const store = new PackageStore(process.argv[2]);
		store.importZip(process.argv[3], async () => {
			process.send('selecting');
			await new Promise(resolve => process.once('disconnect', resolve));
		}).catch(error => { console.error(error); process.exitCode = 1; });
	`, require.resolve('../out/store.js'), storage, zip], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
	const exited = once(child, 'exit');
	try {
		const stage = await Promise.race([
			once(child, 'message').then(([message]) => message),
			exited.then(() => assert.fail('importer exited before selection')),
		]);
		assert.equal(stage, 'selecting');
		const staging = (await managedContents(storage)).find(name => name.startsWith('.import-v2-'));
		assert.ok(staging);
		await store.cleanup();
		await fs.access(join(managed, staging, 'archive.zip'));
		await assert.rejects(store.importZip(zip, selectFirst), PackageBusyError);
		assert.deepEqual(await store.list(), [installed]);
		child.kill('SIGKILL');
		assert.deepEqual(await exited, [null, 'SIGKILL']);
		await store.cleanup();
		assert.deepEqual((await managedContents(storage)).sort(), ['.import-legacy', installed.id].sort());
		assert.equal(await fs.readFile(join(legacy, 'keep'), 'utf8'), 'legacy');
		assert.deepEqual(await store.list(), [installed]);
	} finally {
		if (child.exitCode === null && child.signalCode === null) {
			child.kill('SIGKILL');
			await exited;
		}
	}
});

test('Remove reports a busy package and Refresh retries a failure after rename', { skip: !darwinArm64, timeout: 5000 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const zip = join(root, 'server.zip');
	await nestZip(zip, await testBinary());
	const store = new PackageStore(storage);
	const installed = await store.importZip(zip, selectFirst);
	const otherWindow = new PackageStore(storage);
	const child = spawn(process.execPath, ['-e', `
		const { PackageStore } = require(process.argv[1]);
		const store = new PackageStore(process.argv[2]);
		store.withPackageLease(process.argv[3], async () => {
			process.send('locked');
			await new Promise(resolve => process.once('disconnect', resolve));
		}).catch(error => { console.error(error); process.exitCode = 1; });
	`, require.resolve('../out/store.js'), storage, installed.id], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
	const exited = once(child, 'exit');
	try {
		const locked = await Promise.race([
			once(child, 'message').then(([message]) => message),
			exited.then(() => assert.fail('package owner exited before acquiring its lease')),
		]);
		assert.equal(locked, 'locked');
		await assert.rejects(otherWindow.remove(installed.id), PackageBusyError);
		assert.deepEqual(await otherWindow.list(), [installed]);
	} finally {
		if (child.connected) {
			child.disconnect();
		}
		assert.deepEqual(await exited, [0, null]);
	}

	const remove = fs.rm;
	const tombstone = `.removed-v2-${installed.id}`;
	const failure = t.mock.method(fs, 'rm', async (path, options) => {
		if (path === join(storage, 'managed', tombstone)) {
			throw new Error('simulated disk failure');
		}
		return remove(path, options);
	});
	try {
		await assert.rejects(store.remove(installed.id), /cleanup is incomplete/i);
		assert.deepEqual(await otherWindow.list(), []);
		assert.deepEqual(await managedContents(storage), [tombstone]);
	} finally {
		failure.mock.restore();
	}
	await otherWindow.cleanup();
	await otherWindow.remove(installed.id);
	assert.deepEqual(await managedContents(storage), []);
});

test('Refresh refuses symlinks at the import lease and staging paths', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const storage = join(root, 'storage');
	const store = new PackageStore(storage);
	await store.list();
	const managed = join(storage, 'managed');
	const outside = join(root, 'outside');
	await fs.mkdir(outside, { mode: 0o700 });
	await fs.writeFile(join(outside, 'keep'), 'unrelated');
	const lease = join(managed, '.imports.lock');
	await fs.symlink(join(outside, 'keep'), lease);
	await assert.rejects(store.cleanup(), { code: 'ELOOP' });
	await fs.unlink(lease);
	await fs.symlink(outside, join(managed, '.import-v2-ABC123'));
	await assert.rejects(store.cleanup(), /cleanup is incomplete/i);
	assert.equal(await fs.readFile(join(outside, 'keep'), 'utf8'), 'unrelated');
});

test('rejects an extension storage symlink before creating the managed folder', { skip: !darwinArm64 }, async t => {
	const root = await temp(t);
	const target = join(root, 'target');
	const link = join(root, 'link');
	await fs.mkdir(target);
	await fs.symlink(target, link);
	await assert.rejects(new PackageStore(link).list(), /extension storage path/i);
	assert.deepEqual(await fs.readdir(target), []);
});
