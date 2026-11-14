/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pipeline } = require('node:stream/promises');
const { test, after } = require('node:test');
const { promisify } = require('node:util');
const { ZipFile } = require('yazl');
const { PackageStore } = require('../out/store.js');

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
	assert.deepEqual(await fs.readdir(join(storage, 'managed')), [installed.id]);

	const second = await secondWindow.importZip(zip, selectFirst);
	assert.notEqual(second.id, installed.id);
	await Promise.all([store.remove(installed.id), secondWindow.remove(installed.id)]);
	assert.deepEqual(await store.list(), [second]);
	assert.deepEqual(await fs.readdir(join(storage, 'managed')), [second.id]);
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
	assert.deepEqual(await fs.readdir(join(storage, 'managed')), [installed.id]);
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
			assert.deepEqual(await fs.readdir(join(storage, 'managed')), []);
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
			assert.deepEqual(await fs.readdir(join(storage, 'managed')), []);
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
	await restarted.cleanupRemovedPackages();
	assert.deepEqual(await fs.readdir(managed), [forged]);
	assert.equal(await fs.readFile(join(outside, 'marker'), 'utf8'), 'unrelated');
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
