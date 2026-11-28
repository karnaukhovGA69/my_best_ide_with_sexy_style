/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createHash } from 'crypto';
import { closeSync, constants, createWriteStream, openSync, readdirSync, statSync, writeSync } from 'fs';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, truncate, writeFile, symlink } from 'fs/promises';
import { tmpdir } from 'os';
import { promises as streamPromises } from 'stream';
import { ZipFile } from 'yazl';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { dirname, join } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { inspectLocalVsixV1, withStagedLocalVsix } from '../../node/localVsixStage.js';

suite('Local VSIX staging', function () {
	ensureNoDisposablesAreLeakedInTestSuite();
	const manifestName = 'extension/package.json';
	const manifest = JSON.stringify({ publisher: 'Fixture', name: 'example', version: '1.2.3-beta.1+local', engines: { vscode: '^1.140.0' } });
	let root: string;
	let source: string;
	let stageDirectoriesBefore: Set<string>;

	setup(async function () {
		if (typeof process.getuid !== 'function' || !constants.O_NOFOLLOW || !constants.O_NONBLOCK) {
			this.skip();
		}
		root = await mkdtemp(join(tmpdir(), 'local-vsix-stage-test-'));
		source = join(root, 'source # literal%20.vsix');
		stageDirectoriesBefore = new Set(await readdir(tmpdir()));
	});

	teardown(async () => {
		if (root) {
			await rm(root, { recursive: true, force: true });
		}
	});

	async function archive(entries: readonly { name: string; data: string | Buffer; mode?: number; compress?: boolean }[]): Promise<void> {
		const zip = new ZipFile();
		for (const { name, data, mode, compress } of entries) {
			zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), name, { mode, compress });
		}
		zip.end();
		await streamPromises.pipeline(zip.outputStream, createWriteStream(source));
	}

	async function rejects(code: string, uri = URI.file(source)): Promise<void> {
		await assert.rejects(withStagedLocalVsix(uri, CancellationToken.None, async () => assert.fail('Unexpected staged consumer')), { code });
	}

	function newStageDirectories(): string[] {
		return readdirSync(tmpdir()).filter(name => name.startsWith('nerded-local-vsix-') && !stageDirectoriesBefore.has(name));
	}

	function atCopiedSize(minBytes: number, run: (path: string, size: number) => boolean): CancellationToken {
		let result: boolean | undefined;
		return {
			get isCancellationRequested() {
				if (result === undefined) {
					for (const directory of newStageDirectories()) {
						const path = join(tmpdir(), directory, 'package.vsix');
						const stat = statSync(path, { throwIfNoEntry: false });
						if (stat && stat.size >= minBytes) {
							result = run(path, stat.size);
							break;
						}
					}
				}
				return result ?? false;
			},
			onCancellationRequested: Event.None,
		};
	}

	function changeFirstByte(path: string): void {
		const handle = openSync(path, 'r+');
		try {
			writeSync(handle, Buffer.from([0]), 0, 1, 0);
		} finally {
			closeSync(handle);
		}
	}

	test('binds private snapshot bytes, digest and metadata, and deletes the snapshot when the consumer returns', async () => {
		await archive([
			{ name: manifestName, data: manifest },
			{ name: 'extension.vsixmanifest', data: '<PackageManifest />' },
			{ name: 'extension/resource.txt', data: 'synthetic resource' },
		]);
		const selected = await readFile(source);
		let path: string | undefined;
		const reported = await withStagedLocalVsix(URI.file(source), CancellationToken.None, async staged => {
			path = staged.path;
			assert.notStrictEqual(path, source);
			assert.deepStrictEqual(await readFile(path), selected);
			assert.deepStrictEqual(staged.metadata, { id: 'fixture.example', version: '1.2.3-beta.1+local', engine: '^1.140.0' });
			assert.strictEqual(staged.bytes, selected.length);
			assert.strictEqual(staged.sha256, createHash('sha256').update(selected).digest('hex'));
			const [file, directory] = await Promise.all([lstat(path), lstat(dirname(path))]);
			assert.strictEqual(file.mode & 0o777, 0o600);
			assert.strictEqual(directory.mode & 0o777, 0o700);
			assert.strictEqual(file.uid, process.getuid!());
			assert.strictEqual(directory.uid, file.uid);
			assert.strictEqual(file.nlink, 1);
			await writeFile(source, 'replaced original');
			assert.deepStrictEqual(await readFile(path), selected);
			return 'inspected';
		});
		assert.strictEqual(reported, 'inspected');
		assert.ok(path);
		await assert.rejects(lstat(dirname(path)), { code: 'ENOENT' });
		assert.strictEqual(await readFile(source, 'utf8'), 'replaced original');
	});

	test('exposes only bounded metadata after native inspection and removes the snapshot before resolving', async () => {
		await archive([{ name: manifestName, data: manifest }]);
		const bytes = await readFile(source);
		const uri = URI.file(source);
		assert.strictEqual(await inspectLocalVsixV1(uri, bytes.length - 1, CancellationToken.None), undefined);
		assert.strictEqual(await inspectLocalVsixV1(uri, 32 * 1024 * 1024 + 1, CancellationToken.None), undefined);
		assert.strictEqual(await inspectLocalVsixV1(uri.with({ scheme: 'https' }), bytes.length, CancellationToken.None), undefined);
		assert.deepStrictEqual(await inspectLocalVsixV1(uri, bytes.length, CancellationToken.None), {
			id: 'fixture.example', version: '1.2.3-beta.1+local', engine: '^1.140.0',
			sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
		});
		assert.deepStrictEqual(newStageDirectories(), []);
		assert.deepStrictEqual(await readFile(source), bytes);
	});

	test('propagates native inspection cancellation after cleanup', async () => {
		await archive([{ name: manifestName, data: manifest }]);
		const token = atCopiedSize(1, () => true);
		await assert.rejects(inspectLocalVsixV1(URI.file(source), 32 * 1024 * 1024, token), { name: 'Canceled' });
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('rejects URI aliases and selected directories or symlinks', async () => {
		await archive([{ name: manifestName, data: manifest }]);
		const file = URI.file(source);
		for (const uri of [
			file.with({ scheme: 'https' }),
			file.with({ authority: 'server' }),
			file.with({ query: 'read' }),
			file.with({ fragment: 'artifact' }),
			file.with({ path: file.path.replace('/source', '/../source') }),
			file.with({ path: file.path.replace('/source', '//source') }),
			file.with({ path: file.path.replace('/source', '/source\0') }),
			file.with({ path: file.path.replace('.vsix', '.zip') }),
		]) {
			await rejects('invalid-source', uri);
		}
		const link = join(root, 'symlink.vsix');
		await symlink(source, link);
		await rejects('invalid-source', URI.file(link));
		const directory = join(root, 'directory.vsix');
		await mkdir(directory);
		await rejects('invalid-source', URI.file(directory));
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('stops oversize and malformed sources and removes partial staging', async () => {
		await writeFile(source, Buffer.alloc(22));
		await rejects('invalid-archive');
		await truncate(source, 32 * 1024 * 1024 + 1);
		await rejects('source-size');
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('requires strict bounded manifest data and canonical package metadata', async () => {
		for (const data of [
			Buffer.from([0xff, 0xfe]),
			manifest.replace('"name":"example"', '"name":"example","name":"replacement"'),
			manifest.replace('"vscode":"^1.140.0"', '"vscode":"^1.140.0","vscode":"*"'),
			manifest.replace('"name":"example"', '"name":"example","nested":[{"key":1,"key":2}]'),
			manifest.replace('1.2.3-beta.1+local', 'v1.2.3'),
			manifest.replace('^1.140.0', 'any newer version'),
			manifest + ' '.repeat(64 * 1024),
		]) {
			await archive([{ name: manifestName, data }]);
			await rejects('invalid-archive');
		}
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('rejects ambiguous ZIP paths and nonregular entries before exposing metadata', async () => {
		for (const entry of [
			{ name: 'extension-extra/alias.txt', data: 'alias' },
			{ name: 'extension/.vsixmanifest', data: 'reserved path alias' },
			{ name: 'extension/Package.json', data: manifest },
			{ name: 'extension/link', data: 'outside', mode: 0o120777 },
			{ name: 'extension/CON.txt', data: 'reserved name' },
		]) {
			await archive([{ name: manifestName, data: manifest }, entry]);
			await rejects('invalid-archive');
		}
		await archive([{ name: 'extension/package-other.json', data: manifest }]);
		await rejects('invalid-archive');
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('rejects a changed manifest even when it still parses and the ZIP length is unchanged', async () => {
		await archive([{ name: manifestName, data: manifest, compress: false }]);
		const bytes = await readFile(source);
		const name = bytes.indexOf(Buffer.from('"name":"example"'));
		assert.ok(name > 0);
		bytes[name + '"name":"'.length] = 'a'.charCodeAt(0);
		await writeFile(source, bytes);
		await rejects('invalid-archive');
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('cancellation during copying closes the handles and removes the partial staged file', async () => {
		await archive([{ name: manifestName, data: manifest }, { name: 'extension/resource.txt', data: Buffer.alloc(128 * 1024), compress: false }]);
		let copiedBytes = 0;
		const token = atCopiedSize(1, (_path, bytes) => {
			copiedBytes = bytes;
			return true;
		});
		await assert.rejects(withStagedLocalVsix(URI.file(source), token, async () => assert.fail('Unexpected staged consumer')), { name: 'Canceled' });
		assert.strictEqual(copiedBytes, 64 * 1024);
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('rejects a source modified during copying even after reading its first block', async () => {
		await archive([{ name: manifestName, data: manifest }, { name: 'extension/resource.txt', data: Buffer.alloc(128 * 1024), compress: false }]);
		const token = atCopiedSize(64 * 1024, () => {
			changeFirstByte(source);
			return false;
		});
		await assert.rejects(withStagedLocalVsix(URI.file(source), token, async () => assert.fail('Unexpected staged consumer')), { code: 'source-changed' });
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('rehashes the exact staged descriptor and refuses changed copied bytes', async () => {
		await archive([{ name: manifestName, data: manifest }]);
		const sourceBytes = await readFile(source);
		const token = atCopiedSize(sourceBytes.length, path => {
			changeFirstByte(path);
			return false;
		});
		await assert.rejects(withStagedLocalVsix(URI.file(source), token, async () => assert.fail('Unexpected staged consumer')), { code: 'stage-changed' });
		assert.deepStrictEqual(await readFile(source), sourceBytes);
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('rejects archives above the declared entry count limit', async () => {
		await archive([{ name: manifestName, data: manifest },
			...Array.from({ length: 4096 }, (_, i) => ({ name: `extension/resource-${i}`, data: '', compress: false }))]);
		await rejects('invalid-archive');
		assert.deepStrictEqual(newStageDirectories(), []);
	});

	test('removes the private snapshot if its consumer fails', async () => {
		await archive([{ name: manifestName, data: manifest }]);
		await assert.rejects(withStagedLocalVsix(URI.file(source), CancellationToken.None, async () => {
			throw new Error('synthetic consumer failure');
		}), /synthetic consumer failure/);
		assert.deepStrictEqual(newStageDirectories(), []);
	});
});
