/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { Extensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { StateType } from '../../../../../platform/update/common/update.js';
import { BrowserUpdateService } from '../../../../services/update/browser/updateService.js';
import '../../../../../platform/update/common/update.config.contribution.js';
import '../../browser/update.contribution.js';

suite('Removed IDE update registrations', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('removes updater commands and keeps manual release notes', () => {
		for (const id of ['update.checkForUpdate', 'update.downloadUpdate', 'update.installUpdate', 'update.restartToUpdate', '_update.applyupdate', 'update.showUpdateInfo', 'update.check', 'update.downloadNow', 'update.install', 'update.restart']) {
			assert.strictEqual(CommandsRegistry.getCommand(id), undefined, id);
		}
		assert.ok(CommandsRegistry.getCommand('developer.showCurrentFileAsReleaseNotes'));
	});

	test('does not expose settings for unavailable update behavior', () => {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		for (const key of ['update.mode', 'update.channel', 'update.restartWhenIdle', 'update.titleBar', 'update.showReleaseNotes', 'update.showPostInstallInfo', 'update.showOutdatedBuildReminder', 'update.enableWindowsBackgroundUpdates']) {
			assert.strictEqual(properties[key], undefined, key);
		}
	});

	test('browser updater needs no provider or host and cannot reload', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = store.add(instantiation.createInstance(BrowserUpdateService));
		assert.strictEqual(service.state.type, StateType.Disabled);
		await assert.rejects(service.applyUpdate(), /updates are unavailable/);
		await assert.rejects(service.quitAndInstall(), /updates are unavailable/);
		assert.strictEqual(await service.isLatestVersion(), undefined);
	});
});
