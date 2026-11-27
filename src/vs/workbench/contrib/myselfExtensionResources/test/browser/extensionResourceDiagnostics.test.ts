/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionType } from '../../../../../platform/extensions/common/extensions.js';
import { readExtensionResources } from '../../browser/extensionResourceDiagnostics.js';

type ProfileInventory = Parameters<typeof readExtensionResources>[0];
type LocalEntry = NonNullable<Parameters<typeof readExtensionResources>[1]['installed'][number]['local']>;

function local(id: string, size: number, options?: Partial<LocalEntry>): LocalEntry {
	return {
		identifier: { id },
		location: URI.file('/extensions/' + id),
		isWorkspaceScoped: false,
		type: ExtensionType.User,
		size,
		...options,
	};
}

suite('Extension resource diagnostics', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('lists each local extension with the cached size or unknown', async () => {
		const entries = [
			local('test.zero', 0),
			local('test.normal', 32_768),
			local('TEST.NORMAL', 55_000),
			local('test.builtin', 0, { type: ExtensionType.System }),
			local('test.nan', Number.NaN),
			local('test.negative', -1),
			local('test.fraction', 3.5),
			{ ...local('test.missing', 0), size: undefined },
			local('test.overflow', Number.MAX_SAFE_INTEGER + 1),
		];
		const profile: ProfileInventory = { revision: 2, profileName: 'Coding', inventoryStatus: 'available' };
		const result = await readExtensionResources(profile, {
			whenInitialized: Promise.resolve(),
			installed: entries.map(local => ({ local })),
		});
		assert.deepStrictEqual(result, {
			revision: 2,
			profileName: 'Coding',
			entries: [
				{ id: 'test.builtin', builtIn: true, size: undefined },
				{ id: 'test.fraction', builtIn: false, size: undefined },
				{ id: 'test.missing', builtIn: false, size: undefined },
				{ id: 'test.nan', builtIn: false, size: undefined },
				{ id: 'test.negative', builtIn: false, size: undefined },
				{ id: 'test.normal', builtIn: false, size: 32_768 },
				{ id: 'test.overflow', builtIn: false, size: undefined },
				{ id: 'test.zero', builtIn: false, size: undefined },
			],
		});
	});

	test('excludes remote, network and workspace-scoped entries and keeps a plain display label', async () => {
		const profile: ProfileInventory = { revision: 1, profileName: ' Test\n\u202e profile ', inventoryStatus: 'available' };
		const localEntries = [
			local('test.remote', 12, { location: URI.from({ scheme: 'vscode-remote', authority: 'ssh', path: '/remote' }) }),
			local('test.network', 13, { location: URI.from({ scheme: 'file', authority: 'share', path: '/network' }) }),
			local('test.workspace', 14, { isWorkspaceScoped: true }),
			local('test.\u202eextension', 15),
		];
		const result = await readExtensionResources(profile, {
			whenInitialized: Promise.resolve(),
			installed: [{}, ...localEntries.map(local => ({ local }))],
		});
		assert.deepStrictEqual(result, {
			revision: 1,
			profileName: 'Test profile',
			entries: [{ id: 'test. extension', builtIn: false, size: 15 }],
		});
	});

	test('returns unavailable when the profile changes before the cache settles', async () => {
		const ready = new DeferredPromise<void>();
		const profile = { revision: 1, profileName: 'First', inventoryStatus: 'available' as const };
		let reads = 0;
		const inventory = {
			whenInitialized: ready.p,
			get installed() { reads++; return [{ local: local('test.first', 100) }]; },
		};
		const result = readExtensionResources(profile, inventory);
		assert.strictEqual(reads, 0);
		profile.revision++;
		profile.profileName = 'Second';
		await ready.complete();
		assert.strictEqual(await result, undefined);
		assert.strictEqual(reads, 0);
	});

	test('does not read an unconfirmed cache and reports initialization and cache errors as unavailable', async () => {
		let reads = 0;
		const failing = {
			whenInitialized: Promise.resolve(),
			get installed(): never {
				reads++;
				throw new Error('extension inventory is unavailable');
			},
		};
		const profile = { revision: 5, profileName: 'Current', inventoryStatus: 'profileUnconfirmed' as ProfileInventory['inventoryStatus'] };
		assert.strictEqual(await readExtensionResources(profile, failing), undefined);
		profile.inventoryStatus = 'unavailable';
		assert.strictEqual(await readExtensionResources(profile, failing), undefined);
		assert.strictEqual(reads, 0);
		profile.inventoryStatus = 'available';
		assert.strictEqual(await readExtensionResources(profile, {
			whenInitialized: Promise.reject(new Error('extension initialization failed')),
			get installed() { return failing.installed; },
		}), undefined);
		assert.strictEqual(reads, 0);
		assert.strictEqual(await readExtensionResources(profile, failing), undefined);
		assert.strictEqual(reads, 1);
	});

	test('a later check reflects removal and keeps an empty snapshot available', async () => {
		const profile: ProfileInventory = { revision: 3, profileName: 'Empty', inventoryStatus: 'available' };
		const inventory = {
			whenInitialized: Promise.resolve(),
			installed: [{ local: local('test.removable', 250) }],
		};
		assert.strictEqual((await readExtensionResources(profile, inventory))?.entries.length, 1);
		inventory.installed = [];
		assert.deepStrictEqual(await readExtensionResources(profile, inventory), { revision: 3, profileName: 'Empty', entries: [] });
	});
});
