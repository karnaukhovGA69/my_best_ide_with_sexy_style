/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { autorun } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ContributionEnablementState } from '../../../chat/common/enablement.js';
import { McpService } from '../../common/mcpService.js';
import { LazyCollectionState, McpCollectionDefinition } from '../../common/mcpTypes.js';

suite('Workbench - MCP - runtime service removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('DI construction needs no registry, profile, configuration, storage or logger', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(McpService));
		assert.deepStrictEqual(service.servers.get(), []);
	});

	test('startup and collection refresh allocate no timers and keep observers empty', async () => {
		const clock = sinon.useFakeTimers();
		try {
			const service = store.add(new McpService());
			const serverCounts: number[] = [];
			store.add(autorun(reader => serverCounts.push(service.servers.read(reader).length)));
			await service.activateCollections();
			service.updateCollectedServers();
			service.cancelAutostart();
			service.resetCaches();
			service.resetTrust();
			await clock.tickAsync(1000);
			assert.deepStrictEqual({ serverCounts, timers: clock.countTimers(), frozen: Object.isFrozen(service.servers.get()) }, { serverCounts: [0], timers: 0, frozen: true });
		} finally {
			clock.restore();
		}
	});

	test('autostart completes immediately without inspecting cancellation and returns independent state', () => {
		const service = store.add(new McpService());
		const token = new Proxy(upcastPartial<CancellationToken>({}), { get() { throw new Error('Token accessed'); } });
		for (const cancellation of [undefined, CancellationToken.Cancelled, token]) {
			const result = service.autostart(cancellation).get();
			assert.deepStrictEqual({ ...result }, { working: false, starting: [], serversRequiringInteraction: [] });
			result.working = true;
			result.starting.push({ id: 'stale', label: 'Stale' });
			result.serversRequiringInteraction.push({ id: 'stale', label: 'Stale' });
		}
	});

	test('lazy discovery is complete and cannot retain mutated collection results', () => {
		const service = store.add(new McpService());
		const previous = service.lazyCollectionState.get();
		previous.collections.push(upcastPartial<McpCollectionDefinition>({ id: 'stale' }));
		previous.state = LazyCollectionState.HasUnknown;
		assert.deepStrictEqual(service.lazyCollectionState.get(), { state: LazyCollectionState.AllKnown, collections: [] });
	});

	test('enablement stays disabled across profile/workspace writes and resets', () => {
		const service = store.add(new McpService());
		const model = service.enablementModel;
		for (const state of [ContributionEnablementState.EnabledProfile, ContributionEnablementState.EnabledWorkspace, ContributionEnablementState.DisabledProfile, ContributionEnablementState.DisabledWorkspace]) {
			model.setEnabled('test', state);
			model.setDefaultEnabled?.('test', true);
			model.remove('test');
			service.resetTrust();
			assert.deepStrictEqual({ state: model.readEnabled('test'), profile: model.readProfileEnabled('test'), canSet: model.canSetEnabled?.('test', state) }, {
				state: ContributionEnablementState.DisabledProfile, profile: false, canSet: false,
			});
		}
	});

	test('late operations after disposal cannot restart runtime work', async () => {
		const service = store.add(new McpService());
		service.dispose();
		service.dispose();
		await service.activateCollections();
		service.updateCollectedServers();
		service.cancelAutostart();
		assert.deepStrictEqual({ servers: service.servers.get(), autostart: service.autostart().get() }, { servers: [], autostart: { working: false, starting: [], serversRequiringInteraction: [] } });
	});
});
