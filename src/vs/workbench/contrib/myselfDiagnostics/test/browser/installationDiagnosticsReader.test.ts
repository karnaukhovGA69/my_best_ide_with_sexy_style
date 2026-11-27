/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILocalExtension } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionType, TargetPlatform } from '../../../../../platform/extensions/common/extensions.js';
import { toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { ActivationTimes, IExtensionService, toExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { UserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfileService.js';
import { InstallationDiagnosticsProfileTracker, InstallationDiagnosticsReader } from '../../browser/installationDiagnosticsReader.js';

suite('Installation Diagnostics Reader', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const profileA = toUserDataProfile('a', 'Development', URI.file('/test/profiles/a'), URI.file('/test/cache'));
	const profileB = toUserDataProfile('b', 'Teaching', URI.file('/test/profiles/b'), URI.file('/test/cache'));
	const clangd: ILocalExtension = {
		location: URI.file('/test/extensions/clangd'),
		identifier: { id: 'llvm-vs-code-extensions.vscode-clangd' },
		manifest: { publisher: 'LLVM-VS-Code-Extensions', name: 'vscode-clangd', version: '1.0.0', engines: { vscode: '*' } },
		type: ExtensionType.User, targetPlatform: TargetPlatform.UNIVERSAL, isBuiltin: false, isValid: true, validations: [],
		isWorkspaceScoped: false, isMachineScoped: false, isApplicationScoped: false, publisherId: null,
		isPreReleaseVersion: false, hasPreReleaseVersion: false, private: false, preRelease: false, updated: false,
		pinned: false, forceAutoUpdate: false, source: 'vsix', size: 0,
	};

	function createFixture(initialized = Promise.resolve()) {
		const profiles = store.add(new UserDataProfileService(profileA));
		const profileTracker = store.add(new InstallationDiagnosticsProfileTracker(profiles));
		const reset = store.add(new Emitter<void>());
		const inventory = { installed: [{ local: clangd }], whenInitialized: initialized, onReset: reset.event };
		const enablement = { isEnabled: () => true };
		const running = toExtensionDescription(clangd);
		const runtime: Pick<IExtensionService, 'extensions' | 'getExtensionsStatus'> = {
			extensions: [running],
			getExtensionsStatus: () => ({
				[running.identifier.value]: {
					id: running.identifier,
					messages: [],
					activationStarted: true,
					activationTimes: new ActivationTimes(1, 2, 3, { startup: false, extensionId: running.identifier, activationEvent: 'onLanguage:c' }),
					runtimeErrors: [],
					runningLocation: null,
				}
			}),
		};
		return { profiles, reset, inventory, enablement, runtime, createReader: () => store.add(new InstallationDiagnosticsReader(profileTracker, inventory, enablement, runtime)) };
	}

	function createReader(initialized?: Promise<void>) {
		const fixture = createFixture(initialized);
		return { ...fixture, reader: fixture.createReader() };
	}

	test('reads the actual profile and rejects old cached extensions during a profile switch', async () => {
		const { reader, profiles, reset, inventory } = createReader();
		const first = await reader.collect();
		assert.deepStrictEqual([first.profileName, first.extensions[0].activation, first.extensions[0].languageServer], ['Development', 'activated', 'unverified']);

		await profiles.updateCurrentProfile(profileB);
		const pending = await reader.collect();
		assert.deepStrictEqual([pending.profileName, pending.inventory, pending.extensions[0].installation], ['Teaching', 'unavailable', 'unavailable']);

		inventory.installed = [];
		reset.fire();
		const second = await reader.collect();
		assert.deepStrictEqual(
			[second.profileName, second.inventory, second.extensions.map(extension => extension.installation)],
			['Teaching', 'available', ['notListed', 'notListed', 'notListed', 'notListed']],
		);
	});

	test('rejects the old inventory when switching profiles before the reader is created', async () => {
		const { profiles, reset, inventory, createReader } = createFixture();
		const transition = new DeferredPromise<void>();
		store.add(profiles.onDidChangeCurrentProfile(event => event.join(transition.p)));
		const switching = profiles.updateCurrentProfile(profileB);
		const reader = createReader();
		try {
			const pending = await reader.collect();
			assert.deepStrictEqual([pending.profileName, pending.inventory, pending.extensions[0].installation], ['Teaching', 'unavailable', 'unavailable']);
		} finally {
			await transition.complete();
			await switching;
		}

		inventory.installed = [];
		reset.fire();
		const current = await reader.collect();
		assert.deepStrictEqual([current.profileName, current.inventory, current.extensions[0].installation], ['Teaching', 'available', 'notListed']);
	});

	test('keeps inventory unavailable if a startup reset finished before the reader could observe it', async () => {
		const { profiles, reset, inventory, createReader } = createFixture();
		await profiles.updateCurrentProfile(profileB);
		inventory.installed = [];
		reset.fire();

		const snapshot = await createReader().collect();
		assert.deepStrictEqual([snapshot.profileName, snapshot.inventory], ['Teaching', 'unavailable']);
	});

	test('does not trust a reset that an in-flight startup scan can overwrite', async () => {
		const initialized = new DeferredPromise<void>();
		const { reader, profiles, reset, inventory } = createReader(initialized.p);
		await profiles.updateCurrentProfile(profileB);
		inventory.installed = [];
		reset.fire();
		inventory.installed = [{ local: clangd }];
		await initialized.complete();

		const snapshot = await reader.collect();
		assert.deepStrictEqual([snapshot.profileName, snapshot.inventory, snapshot.extensions[0].installation], ['Teaching', 'profileUnconfirmed', 'unavailable']);
	});

	test('discards a snapshot when the profile changes and switches back during startup', async () => {
		const initialized = new DeferredPromise<void>();
		const { reader, profiles, reset } = createReader(initialized.p);
		const pending = reader.collect();

		await profiles.updateCurrentProfile(profileB);
		await profiles.updateCurrentProfile(profileA);
		await initialized.complete();
		reset.fire();
		reset.fire();

		const invalidated = await pending;
		assert.deepStrictEqual([invalidated.profileName, invalidated.inventory], ['Development', 'profileChanged']);
		assert.strictEqual((await reader.collect()).inventory, 'profileUnconfirmed');

		await profiles.updateCurrentProfile({ ...profileA, name: 'Renamed' });
		assert.strictEqual((await reader.collect()).inventory, 'profileUnconfirmed');

		await profiles.updateCurrentProfile(profileB);
		reset.fire();
		assert.strictEqual((await reader.collect()).inventory, 'available');
	});

	test('distinguishes initialization failure from an empty local inventory', async () => {
		const initialized = new DeferredPromise<void>();
		const { reader } = createReader(initialized.p);
		const pending = reader.collect();
		await initialized.error(new Error('inventory unavailable'));

		const snapshot = await pending;
		assert.deepStrictEqual([snapshot.inventory, snapshot.extensions[0].installation], ['unavailable', 'unavailable']);
	});

	test('does not apply activation from a different installed instance', async () => {
		const { reader, inventory } = createReader();
		inventory.installed = [{ local: { ...clangd, manifest: { ...clangd.manifest, version: '2.0.0' } } }];
		const snapshot = await reader.collect();
		assert.deepStrictEqual(
			[snapshot.extensions[0].installation, snapshot.extensions[0].enablement, snapshot.extensions[0].activation, snapshot.extensions[0].languageServer],
			['installed', 'enabled', 'unavailable', 'unverified'],
		);
	});

	test('preserves the inventory when enablement and runtime reads fail', async () => {
		const { reader, enablement, runtime } = createReader();
		enablement.isEnabled = () => { throw new Error('enablement unavailable'); };
		runtime.getExtensionsStatus = () => { throw new Error('runtime unavailable'); };
		const snapshot = await reader.collect();
		assert.deepStrictEqual(
			[snapshot.extensions[0].installation, snapshot.extensions[0].enablement, snapshot.extensions[0].activation, snapshot.extensions[0].languageServer],
			['installed', 'unavailable', 'unavailable', 'unverified'],
		);
	});

	test('excludes remote and workspace-scoped packages from the local profile inventory', async () => {
		const { reader, inventory } = createReader();
		inventory.installed = [
			{ local: { ...clangd, location: URI.parse('vscode-remote://test/extensions/clangd') } },
			{ local: { ...clangd, isWorkspaceScoped: true } },
		];
		const snapshot = await reader.collect();
		assert.strictEqual(snapshot.extensions[0].installation, 'notListed');
	});
});
