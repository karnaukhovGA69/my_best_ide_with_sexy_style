/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { AgentsVoiceWindowService } from '../../browser/agentsVoiceWindowService.js';
import { AgentsVoiceSessionsPicker } from '../../browser/agentsVoiceSessionsPicker.js';

suite('Voice window and picker unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs both services through strict DI without workbench services', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(AgentsVoiceWindowService));
		await service.openWindow();
		await instantiation.createInstance(AgentsVoiceSessionsPicker, () => assert.fail('Unexpected selection')).show();
		assert.strictEqual(service.isOpen, false);
	});

	test('never creates windows, ownership channels, unload handlers or polling timers', async () => {
		const sandbox = sinon.createSandbox();
		try {
			const clock = sandbox.useFakeTimers();
			const channel = sandbox.stub(mainWindow, 'BroadcastChannel').throws(new Error('Unexpected channel'));
			const open = sandbox.stub(mainWindow, 'open').throws(new Error('Unexpected window'));
			const listeners = sandbox.spy(mainWindow, 'addEventListener');
			const service = store.add(new AgentsVoiceWindowService());
			let events = 0;
			store.add(service.onDidChangeOpen(() => events++));
			await Promise.all([service.openWindow(), service.toggleWindow()]);
			service.closeWindow();
			await service.toggleWindow();
			await clock.tickAsync(60_000);
			assert.strictEqual(service.isOpen, false);
			assert.strictEqual(events, 0);
			assert.strictEqual(channel.callCount, 0);
			assert.strictEqual(open.callCount, 0);
			assert.strictEqual(listeners.callCount, 0);
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('showing the picker never invokes session selection', async () => {
		const picker = new AgentsVoiceSessionsPicker(() => assert.fail('Unexpected selection'));
		await Promise.all([picker.show(), picker.show()]);
	});

	test('window operations remain inactive after disposal', async () => {
		const service = store.add(new AgentsVoiceWindowService());
		service.dispose();
		service.dispose();
		await service.openWindow();
		await service.toggleWindow();
		service.closeWindow();
		assert.strictEqual(service.isOpen, false);
	});
});
