/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ILocalVsixInspection } from '../../../../../platform/extensionManagement/common/extensionManagementIpc.js';
import { createFileSystemProviderError, FileSystemProviderErrorCode, FileType, type IFileSystemProvider, type IStat } from '../../../../../platform/files/common/files.js';
import { inspectLocalVsixSet, type LocalVsixInspector } from '../../browser/localVsixSetMetadata.js';
import type { ILocalVsixSet } from '../../common/localVsixSet.js';

suite('Local VSIX Metadata', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const directory = URI.file(isWindows ? 'C:\\example' : '/example');
	const sha256 = 'ab'.repeat(32);
	const payload: ILocalVsixInspection = { id: 'publisher.extension-0', version: '1.2.3', engine: '^1.146.0', sha256, bytes: 24 };

	function declarations(...files: string[]): ILocalVsixSet {
		return {
			version: 1,
			entries: files.map((file, index) => ({ file, id: `publisher.extension-${index}`, version: '1.2.3', sha256 })),
		};
	}

	function fixture() {
		let registered = true;
		let directoryMtime = 0;
		const calls: { resource: string; maxBytes: number }[] = [];
		const stats: string[] = [];
		const attributes = new Map<string, IStat>();
		const provider = new class extends mock<IFileSystemProvider>() {
			override async stat(resource: URI): Promise<IStat> {
				stats.push(resource.toString());
				if (resource.toString() === directory.toString()) {
					return { type: FileType.Directory, size: 0, ctime: 0, mtime: directoryMtime };
				}
				const stat = attributes.get(resource.toString());
				if (!stat) {
					throw createFileSystemProviderError('private missing path', FileSystemProviderErrorCode.FileNotFound);
				}
				return stat;
			}
		}();
		const files = {
			getProvider(scheme: string) {
				assert.strictEqual(scheme, Schemas.file);
				return registered ? provider : undefined;
			},
		};
		return {
			calls, stats,
			unregister: () => { registered = false; },
			changeDirectory: () => { directoryMtime++; },
			file: (name: string, changes: Partial<IStat> = {}) => attributes.set(joinPath(directory, name).toString(), {
				type: FileType.File, size: 24, ctime: 0, mtime: 0, ...changes,
			}),
			verify: (set: ILocalVsixSet, inspector: LocalVsixInspector, limits?: { archiveBytes: number; totalSourceBytes: number }, folder = directory) =>
				inspectLocalVsixSet(files, async (resource, maxBytes, token) => {
					calls.push({ resource: resource.toString(), maxBytes });
					return inspector(resource, maxBytes, token);
				}, folder, set, CancellationToken.None, limits),
		};
	}

	test('only inspects regular, selected lexical basenames and reports missing and unavailable separately', async () => {
		const state = fixture();
		state.file('regular.vsix');
		state.file('link.vsix', { type: FileType.File | FileType.SymbolicLink });
		state.file('special.vsix', { type: FileType.Unknown });
		const declared = declarations('regular.vsix', 'link.vsix', 'special.vsix', 'missing.vsix', '../outside.vsix');
		const set = { ...declared, entries: [{ ...declared.entries[0], id: 'Publisher.Extension-0' }, ...declared.entries.slice(1)] };
		const results = await state.verify(set, async () => payload);
		assert.deepStrictEqual(results, [
			{ kind: 'checked', inspection: payload, idMatches: true, versionMatches: true, sha256Matches: true },
			{ kind: 'unavailable' }, { kind: 'unavailable' }, { kind: 'missing' }, { kind: 'unavailable' },
		]);
		assert.deepStrictEqual(state.calls, [{ resource: joinPath(directory, 'regular.vsix').toString(), maxBytes: 24 }]);
		assert.ok(state.stats.every(stat => !stat.includes('outside.vsix')));
	});

	test('reserves reads from failed inspectors and respects the sentinel at the total byte boundary', async () => {
		const state = fixture();
		state.file('first.vsix', { size: 25 });
		state.file('second.vsix');
		state.file('third.vsix');
		const set = declarations('first.vsix', 'second.vsix', 'third.vsix');
		const result = await state.verify(set, async () => { throw new Error('private backend detail'); }, { archiveBytes: 25, totalSourceBytes: 50 });
		assert.deepStrictEqual(result, set.entries.map(() => ({ kind: 'unavailable' })));
		assert.deepStrictEqual(state.calls, [{ resource: joinPath(directory, 'first.vsix').toString(), maxBytes: 25 }]);
	});

	test('rejects malformed, stale-size and changed files before publishing any declared comparison', async () => {
		const state = fixture();
		for (const file of ['invalid.vsix', 'too-small.vsix', 'changed.vsix']) {
			state.file(file);
		}
		const set = declarations('invalid.vsix', 'too-small.vsix', 'changed.vsix');
		const result = await state.verify(set, async resource => {
			if (resource.path.endsWith('invalid.vsix')) {
				return { ...payload, engine: '<unsafe text>' };
			}
			if (resource.path.endsWith('too-small.vsix')) {
				return { ...payload, bytes: 23 };
			}
			state.file('changed.vsix', { ctime: 1 });
			return payload;
		});
		assert.deepStrictEqual(result, set.entries.map(() => ({ kind: 'unavailable' })));
	});

	test('discards all rows if the registered provider goes away during the inspection', async () => {
		const state = fixture();
		state.file('first.vsix');
		state.file('second.vsix');
		const set = declarations('first.vsix', 'second.vsix');
		const result = await state.verify(set, async () => { state.unregister(); return payload; });
		assert.strictEqual(result, undefined);
		assert.strictEqual(state.calls.length, 1);
	});

	test('discards results when the selected directory changed during the inspection', async () => {
		const state = fixture();
		state.file('first.vsix');
		const result = await state.verify(declarations('first.vsix'), async () => { state.changeDirectory(); return payload; });
		assert.strictEqual(result, undefined);
		assert.strictEqual(state.calls.length, 1);
	});

	test('rejects an unrelated directory scheme before stat or dispatch', async () => {
		const state = fixture();
		const set = declarations('first.vsix');
		const result = await state.verify(set, async () => assert.fail('Unexpected inspector call'), undefined, directory.with({ scheme: Schemas.vscodeRemote }));
		assert.deepStrictEqual(result, [{ kind: 'unavailable' }]);
		assert.deepStrictEqual([state.stats, state.calls], [[], []]);
	});
});
