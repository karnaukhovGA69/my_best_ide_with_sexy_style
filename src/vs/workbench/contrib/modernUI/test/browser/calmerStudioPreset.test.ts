/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { URI } from '../../../../../base/common/uri.js';
import { toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { UserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfileService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InMemoryStorageService, IS_NEW_KEY, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { CalmerStudioPresetContribution, applyCalmerStudioPreset, initializeCalmerStudioPreset, CALMER_PRESET_MARKER, CALMER_STUDIO_SETTING } from '../../browser/calmerStudioPreset.js';

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
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), true);
		assert.deepStrictEqual(f.writes, [
			['workbench.colorTheme', 'Nerded Calm', ConfigurationTarget.USER_LOCAL],
			['workbench.iconTheme', 'nerded-calm-file-icons', ConfigurationTarget.USER_LOCAL],
			['workbench.experimental.modernUI', false, ConfigurationTarget.USER_LOCAL],
			[CALMER_STUDIO_SETTING, true, ConfigurationTarget.USER_LOCAL],
			['editor.minimap.enabled', false, ConfigurationTarget.USER_LOCAL],
			['breadcrumbs.enabled', false, ConfigurationTarget.USER_LOCAL],
			['workbench.activityBar.location', 'hidden', ConfigurationTarget.USER_LOCAL],
		]);
		assert.strictEqual(f.configuration.getValue('editor.fontSize'), 19);
		assert.deepStrictEqual(f.configuration.getValue('workbench.colorCustomizations'), { foreground: '#abcdef' });
		assert.strictEqual(f.storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE), true);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), false);
		assert.strictEqual(f.writes.length, 7);
	});

	test('fresh-profile chrome defaults preserve explicit and shared view choices', async () => {
		const f = fixture(true, { 'editor.minimap.enabled': true, 'breadcrumbs.enabled': true, 'workbench.settings.applyToAllProfiles': ['workbench.activityBar.location'] });
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), true);
		assert.strictEqual(f.writes.length, 4);
		assert.strictEqual(f.configuration.getValue('editor.minimap.enabled'), true);
		assert.strictEqual(f.configuration.getValue('breadcrumbs.enabled'), true);
	});

	test('a completed first-run marker prevents reapplying after settings are reset', async () => {
		const f = fixture(true);
		f.storage.store(CALMER_PRESET_MARKER, true, StorageScope.PROFILE, StorageTarget.MACHINE);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), false);
		assert.deepStrictEqual(f.writes, []);
	});

	test('shared appearance keys are never initialized through another profile', async () => {
		const f = fixture(true, { 'workbench.settings.applyToAllProfiles': ['workbench.colorTheme'] });
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), false);
		assert.deepStrictEqual(f.writes, []);
		const independent = fixture(true, { 'workbench.settings.applyToAllProfiles': ['editor.fontFamily'] });
		assert.strictEqual(await initializeCalmerStudioPreset(independent.configuration, independent.storage, {}), true);
	});

	test('a new profile sharing default settings never writes to the default profile', async () => {
		const f = fixture(true);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, { useDefaultFlags: { settings: true } }), false);
		assert.deepStrictEqual(f.writes, []);
	});

	test('profile completion waits for joined changes and reports failed switches', async () => {
		const profile = (id: string) => toUserDataProfile(id, id, URI.file('/profiles/' + id), URI.file('/cache'));
		const profiles = store.add(new UserDataProfileService(profile('old')));
		let completion: Promise<boolean> | undefined;
		const gate = new DeferredPromise<void>();
		const listener = profiles.onDidChangeCurrentProfile(event => { completion = event.whenSettled; event.join(gate.p); });
		const switching = profiles.updateCurrentProfile(profile('new')); let settled = false;
		void completion!.then(() => { settled = true; });
		await Promise.resolve(); assert.strictEqual(settled, false);
		await gate.complete(); await switching; assert.strictEqual(await completion, true); listener.dispose();
		store.add(profiles.onDidChangeCurrentProfile(event => { completion = event.whenSettled; event.join(Promise.reject(new Error('switch failed'))); }));
		await assert.rejects(profiles.updateCurrentProfile(profile('failed')), /switch failed/);
		assert.strictEqual(await completion, false);
	});

	test('new profiles receive the preset only after profile services have switched', async () => {
		const f = fixture(false);
		const profile = (id: string) => toUserDataProfile(id, id, URI.file('/profiles/' + id), URI.file('/cache'));
		const profiles = store.add(new UserDataProfileService(profile('old')));
		const gate = new DeferredPromise<void>();
		store.add(profiles.onDidChangeCurrentProfile(event => event.join(gate.p)));
		store.add(new CalmerStudioPresetContribution(f.configuration, f.storage, new NullLogService(), profiles));
		const initialized = new DeferredPromise<void>();
		const originalStore = f.storage.store.bind(f.storage);
		f.storage.store = (key, value, scope, target) => {
			originalStore(key, value, scope, target);
			if (key === CALMER_PRESET_MARKER) { void initialized.complete(); }
		};
		const switching = profiles.updateCurrentProfile(profile('new'));
		await Promise.resolve(); assert.deepStrictEqual(f.writes, []);
		f.storage.store(IS_NEW_KEY, true, StorageScope.PROFILE, StorageTarget.MACHINE);
		await gate.complete(); await switching;
		await initialized.p;
		assert.strictEqual(f.writes.length, 7);
		assert.strictEqual(f.storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE), true);
	});

	test('does not change an existing profile even when it uses defaults', async () => {
		const f = fixture(false);
		assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), false);
		assert.deepStrictEqual(f.writes, []);
	});

	test('preserves explicit new-profile choices including null icons and false layout flags', async () => {
		for (const values of [{ 'workbench.colorTheme': 'Custom' }, { workbench: { iconTheme: null } }, { [CALMER_STUDIO_SETTING]: false }, { 'workbench.experimental.modernUI': false }]) {
			const f = fixture(true, values);
			assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), false);
			assert.deepStrictEqual(f.writes, []);
		}
	});

	test('respects managed settings and transient overrides', async () => {
		for (const kind of ['policyValue', 'memoryValue', 'workspaceValue', 'userRemoteValue'] as const) {
			const f = fixture(true);
			f.configuration.inspect = <T>() => ({ [kind]: 'custom' as T });
			assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}), false);
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
		await assert.rejects(initializeCalmerStudioPreset(f.configuration, f.storage, {}), error => error === failure);
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
			assert.strictEqual(await initializeCalmerStudioPreset(f.configuration, f.storage, {}, () => cancelled), false);
			assert.strictEqual(f.writes.length, 1);
			assert.strictEqual(f.storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE, false), false);
		}
	});
});
