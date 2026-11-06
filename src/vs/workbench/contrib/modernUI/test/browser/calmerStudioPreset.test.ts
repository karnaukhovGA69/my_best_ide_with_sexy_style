/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InMemoryStorageService, IS_NEW_KEY, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { applyCalmerStudioPreset, initializeCalmerStudioPreset, CALMER_PRESET_MARKER, CALMER_STUDIO_SETTING } from '../../browser/calmerStudioPreset.js';

suite('Calmer Studio profile preset', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	function fixture(isNew: boolean, values: Record<string, unknown> = {}) {
		const configuration = new TestConfigurationService(values);
		store.add(configuration.onDidChangeConfigurationEmitter);
		const storage = store.add(new InMemoryStorageService());
		storage.store(IS_NEW_KEY, isNew, StorageScope.PROFILE, StorageTarget.MACHINE);
		const writes: [string, unknown, ConfigurationTarget | undefined][] = [];
		configuration.updateValue = async (key: string, value: unknown, target?: ConfigurationTarget) => {
			writes.push([key, value, target]); await configuration.setUserConfiguration(key, value);
		};
		return { configuration, storage, writes };
	}

	test('initializes an untouched new profile locally once and preserves unrelated settings', async () => {
		const f = fixture(true, { 'editor.fontSize': 19, 'workbench.colorCustomizations': { foreground: '#abcdef' } });
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage), true);
		assert.deepStrictEqual(f.writes, [
			['workbench.colorTheme', 'Nerded Calm', ConfigurationTarget.USER_LOCAL],
			['workbench.iconTheme', 'nerded-calm-file-icons', ConfigurationTarget.USER_LOCAL],
			['workbench.experimental.modernUI', false, ConfigurationTarget.USER_LOCAL],
			[CALMER_STUDIO_SETTING, true, ConfigurationTarget.USER_LOCAL],
		]);
		assert.strictEqual(f.configuration.getValue('editor.fontSize'), 19);
		assert.deepStrictEqual(f.configuration.getValue('workbench.colorCustomizations'), { foreground: '#abcdef' });
		assert.strictEqual(f.storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE), true);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage), false);
		assert.strictEqual(f.writes.length, 4);
	});

	test('a completed first-run marker prevents reapplying after settings are reset', async () => {
		const f = fixture(true);
		f.storage.store(CALMER_PRESET_MARKER, true, StorageScope.PROFILE, StorageTarget.MACHINE);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage), false);
		assert.deepStrictEqual(f.writes, []);
	});

	test('does not change an existing profile even when it uses defaults', async () => {
		const f = fixture(false);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage), false);
		assert.deepStrictEqual(f.writes, []);
	});

	test('preserves explicit new-profile choices including null icons and false layout flags', async () => {
		for (const values of [{ 'workbench.colorTheme': 'Custom' }, { workbench: { iconTheme: null } }, { [CALMER_STUDIO_SETTING]: false }, { 'workbench.experimental.modernUI': false }]) {
			const f = fixture(true, values);
			assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage), false);
			assert.deepStrictEqual(f.writes, []);
		}
	});

	test('respects managed settings and transient overrides', async () => {
		for (const kind of ['policyValue', 'memoryValue', 'workspaceValue', 'userRemoteValue'] as const) {
			const f = fixture(true);
			f.configuration.inspect = <T>() => ({ [kind]: 'custom' as T });
			assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage), false);
			assert.deepStrictEqual(f.writes, []);
		}
	});

	test('explicit application changes only the preset keys and retains normal target resolution', async () => {
		const f = fixture(false, { 'editor.fontSize': 21, 'workbench.colorTheme': 'Previous', 'editor.tokenColorCustomizations': { comments: '#aaa' } });
		await applyCalmerStudioPreset(f.configuration);
		assert.strictEqual(f.writes.length, 4);
		assert.ok(f.writes.every(([, , target]) => target === undefined));
		assert.strictEqual(f.configuration.getValue('editor.fontSize'), 21);
		assert.deepStrictEqual(f.configuration.getValue('editor.tokenColorCustomizations'), { comments: '#aaa' });
	});

	test('failed initialization never records success and manual failures propagate', async () => {
		const f = fixture(true); const failure = new Error('write failed');
		f.configuration.updateValue = async () => { throw failure; };
		await assert.rejects(initializeCalmerStudioPreset(f.configuration, f.storage), error => error === failure);
		assert.strictEqual(f.storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE, false), false);
		await assert.rejects(applyCalmerStudioPreset(f.configuration), error => error === failure);
	});

	test('cancellation or a user choice during initialization stops subsequent writes', async () => {
		for (const cancel of [true, false]) {
			const f = fixture(true); const original = f.configuration.updateValue.bind(f.configuration); let cancelled = false;
			f.configuration.updateValue = async (key, value) => {
				await original(key, value);
				if (cancel) { cancelled = true; } else { await f.configuration.setUserConfiguration('workbench.iconTheme', 'User Choice'); }
			};
			assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, () => cancelled), false);
			assert.strictEqual(f.writes.length, 1);
			assert.strictEqual(f.storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE, false), false);
		}
	});
});
