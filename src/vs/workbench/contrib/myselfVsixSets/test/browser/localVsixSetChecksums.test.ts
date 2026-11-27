/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createFileSystemProviderError, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, type IFileOpenOptions, type IFileSystemProviderWithOpenReadWriteCloseCapability } from '../../../../../platform/files/common/files.js';
import { checkLocalVsixSetChecksums } from '../../browser/localVsixSetChecksums.js';
import type { ILocalVsixSet } from '../../common/localVsixSet.js';

suite('Local VSIX Set Checksums', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const directory = URI.file(isWindows ? 'C:\\example' : '/example');
	const bytes = new TextEncoder().encode('abc');
	const abcSha256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
	function manifest(...files: string[]): ILocalVsixSet {
		return {
			version: 1,
			entries: files.map((file, index) => ({ file, id: `publisher.extension-${index}`, version: '1.0.0', sha256: abcSha256 })),
		};
	}

	function fixture() {
		const assets = new Map<string, { bytes: Uint8Array; type: FileType; size: number; mtime: number }>();
		const handles = new Map<number, string>();
		const reads: { readonly file: string; readonly requested: number; readonly actual: number }[] = [];
		const opened: string[] = [];
		const closed: string[] = [];
		let registered = true;
		let lookups = 0;
		let directoryType = FileType.Directory;
		let beforeRead: (() => void | Promise<void>) | undefined;
		const provider = new class extends mock<IFileSystemProviderWithOpenReadWriteCloseCapability>() {
			override readonly capabilities = FileSystemProviderCapabilities.FileOpenReadWriteClose;
			override async stat(resource: URI) {
				if (resource.toString() === directory.toString()) {
					return { type: directoryType, ctime: 0, mtime: 0, size: 0 };
				}
				const asset = assets.get(resource.toString());
				if (!asset) {
					throw createFileSystemProviderError('private missing path', FileSystemProviderErrorCode.FileNotFound);
				}
				return { type: asset.type, ctime: 0, mtime: asset.mtime, size: asset.size };
			}
			override async open(resource: URI, options: IFileOpenOptions) {
				assert.deepStrictEqual(options, { create: false });
				const file = resource.toString();
				assert.ok(assets.has(file));
				assert.strictEqual(handles.size, 0, 'Only one archive handle may be open at a time');
				opened.push(file);
				handles.set(opened.length, file);
				return opened.length;
			}
			override async read(fd: number, pos: number, data: Uint8Array, offset: number, length: number) {
				const file = handles.get(fd)!;
				const chunk = assets.get(file)!.bytes.subarray(pos, pos + Math.min(2, length));
				reads.push({ file, requested: length, actual: chunk.length });
				await beforeRead?.();
				data.set(chunk, offset);
				return chunk.length;
			}
			override async close(fd: number) {
				const file = handles.get(fd);
				assert.ok(file);
				closed.push(file);
				handles.delete(fd);
			}
		}();
		const files = {
			getProvider(scheme: string) {
				assert.strictEqual(scheme, Schemas.file);
				lookups++;
				return registered ? provider : undefined;
			},
		};
		return {
			opened, closed, reads,
			getLookups: () => lookups,
			unregister: () => { registered = false; },
			setDirectoryType: (type: FileType) => { directoryType = type; },
			setBeforeRead: (callback: typeof beforeRead) => { beforeRead = callback; },
			asset: (file: string, overrides: Partial<{ bytes: Uint8Array; type: FileType; size: number; mtime: number }> = {}) => {
				const asset = { bytes, size: bytes.length, type: FileType.File, mtime: 0, ...overrides };
				assets.set(joinPath(directory, file).toString(), asset);
				return asset;
			},
			check: (set: ILocalVsixSet, token = CancellationToken.None, limits?: { archiveBytes: number; totalReadBytes: number }) =>
				checkLocalVsixSetChecksums(files, directory, set, token, limits),
		};
	}

	test('hashes one regular file at a time and reports matches, mismatches, missing files and rejected types', async () => {
		const state = fixture();
		state.asset('match.vsix');
		state.asset('mismatch.vsix', { bytes: new TextEncoder().encode('xyz') });
		state.asset('link.vsix', { type: FileType.File | FileType.SymbolicLink });
		state.asset('special.vsix', { type: FileType.Unknown });
		const set = manifest('match.vsix', 'mismatch.vsix', 'missing.vsix', 'link.vsix', 'special.vsix');
		assert.deepStrictEqual(await state.check(set, CancellationToken.None, { archiveBytes: 3, totalReadBytes: 7 }), [
			'match', 'mismatch', 'missing', 'unavailable', 'unavailable',
		]);
		assert.deepStrictEqual(state.opened, [joinPath(directory, 'match.vsix').toString(), joinPath(directory, 'mismatch.vsix').toString()]);
		assert.deepStrictEqual(state.closed, state.opened);
	});

	test('disallows a symlink as the immediate manifest directory', async () => {
		const state = fixture();
		state.asset('match.vsix');
		state.setDirectoryType(FileType.Directory | FileType.SymbolicLink);
		assert.deepStrictEqual(await state.check(manifest('match.vsix')), ['unavailable']);
		assert.deepStrictEqual(state.opened, []);
	});

	test('charges an archive growth sentinel against the total budget and skips over-limit files', async () => {
		const state = fixture();
		state.asset('oversized.vsix', { size: 5 });
		state.asset('grew.vsix', { size: 1 });
		state.asset('second.vsix');
		state.asset('empty.vsix', { bytes: new Uint8Array(), size: 0 });
		const set = manifest('oversized.vsix', 'grew.vsix', 'second.vsix', 'empty.vsix');
		assert.deepStrictEqual(await state.check(set, CancellationToken.None, { archiveBytes: 4, totalReadBytes: 5 }), [
			'unavailable', 'unavailable', 'unavailable', 'mismatch',
		]);
		assert.deepStrictEqual(state.reads.map(({ requested, actual }) => [requested, actual]), [[2, 2], [1, 0]]);
		assert.deepStrictEqual(state.opened, [joinPath(directory, 'grew.vsix').toString(), joinPath(directory, 'empty.vsix').toString()]);
	});

	test('rejects a size or metadata change without presenting the digest as a match', async () => {
		const state = fixture();
		state.asset('shrunk.vsix', { size: 4 });
		const changed = state.asset('changed.vsix');
		state.setBeforeRead(() => { changed.mtime++; });
		assert.deepStrictEqual(await state.check(manifest('shrunk.vsix', 'changed.vsix')), ['unavailable', 'unavailable']);
		assert.deepStrictEqual(state.closed, state.opened);
	});

	test('publishes no partial results if cancelled during an archive read', async () => {
		const state = fixture();
		state.asset('first.vsix');
		state.asset('second.vsix');
		state.asset('third.vsix');
		const duringSecond = new DeferredPromise<void>();
		const release = new DeferredPromise<void>();
		const cancellation = store.add(new CancellationTokenSource());
		state.setBeforeRead(async () => {
			if (state.opened.length === 2) {
				void duringSecond.complete();
				await release.p;
			}
		});
		const checking = state.check(manifest('first.vsix', 'second.vsix', 'third.vsix'), cancellation.token);
		await duringSecond.p;
		cancellation.cancel();
		await release.complete();
		assert.strictEqual(await checking, undefined);
		assert.strictEqual(state.opened.length, 2);
		assert.deepStrictEqual(state.closed, state.opened);
		assert.strictEqual(state.reads.filter(read => read.file === state.opened[1]).length, 1);
	});

	test('closes the existing handle and stops further reads if registration changes', async () => {
		const state = fixture();
		state.asset('first.vsix');
		state.asset('second.vsix');
		state.setBeforeRead(state.unregister);
		assert.deepStrictEqual(await state.check(manifest('first.vsix', 'second.vsix')), ['unavailable', 'unavailable']);
		assert.strictEqual(state.opened.length, 1);
		assert.strictEqual(state.reads.length, 1);
		assert.deepStrictEqual(state.closed, state.opened);
	});

	test('starts no provider lookup when already cancelled and treats missing provider as unavailable', async () => {
		const state = fixture();
		assert.strictEqual(await state.check(manifest('first.vsix'), CancellationToken.Cancelled), undefined);
		assert.strictEqual(state.getLookups(), 0);
		state.unregister();
		assert.deepStrictEqual(await state.check(manifest('first.vsix')), ['unavailable']);
		assert.deepStrictEqual(state.opened, []);
	});
});
