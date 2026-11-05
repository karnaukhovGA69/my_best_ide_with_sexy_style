/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { DisabledUpdateService } from '../../common/disabledUpdateService.js';
import { DisablementReason, StateType } from '../../common/update.js';
import { UpdateChannel } from '../../common/updateIpc.js';
import { TestInstantiationService } from '../../../instantiation/test/common/instantiationServiceMock.js';

suite('Disabled IDE updater', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs without services and never changes disabled state', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = store.add(instantiation.createInstance(DisabledUpdateService));
		let events = 0;
		store.add(service.onStateChange(() => events++));
		assert.deepStrictEqual(service.state, { type: StateType.Disabled, reason: DisablementReason.DisabledByEnvironment });
		assert.ok(Object.isFrozen(service.state));
		await service.setInternalOrg('example');
		assert.strictEqual(await service.isLatestVersion(), undefined);
		assert.strictEqual(events, 0);
	});

	test('IPC rejects checks, downloads, installs and restarts without emitting state', async () => {
		const service = store.add(new DisabledUpdateService());
		const channel = new UpdateChannel(service);
		let events = 0;
		store.add(channel.listen(undefined, 'onStateChange')(() => events++));
		for (const command of ['checkForUpdates', 'downloadUpdate', 'applyUpdate', 'quitAndInstall', '_applySpecificUpdate']) {
			await assert.rejects(channel.call(undefined, command, true), /updates are unavailable/);
		}
		assert.strictEqual(await channel.call(undefined, '_getInitialState'), service.state);
		assert.strictEqual(await channel.call(undefined, 'isLatestVersion'), undefined);
		assert.strictEqual(events, 0);
	});
});
