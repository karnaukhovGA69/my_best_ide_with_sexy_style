/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IWalkthroughLoose, WalkthroughsService } from '../../browser/gettingStartedService.js';

suite('Disabled walkthrough progress', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	function create() {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		return store.add(instantiation.createInstance(WalkthroughsService));
	}
	test('creates without storage, telemetry, file or editor services', () => {
		const service = create();
		assert.deepStrictEqual(service.getWalkthroughs(), []);
		assert.throws(() => service.getWalkthrough('missing'), /Walkthroughs are unavailable/);
	});
	test('does not inspect contributed walkthroughs or publish progress', () => {
		const service = create();
		let events = 0;
		for (const event of [service.onDidAddWalkthrough, service.onDidRemoveWalkthrough, service.onDidChangeWalkthrough, service.onDidProgressStep]) {
			store.add(event(() => events++));
		}
		const descriptor = new Proxy({} as IWalkthroughLoose, { get() { throw new Error('must not inspect extension contribution'); } });
		service.registerWalkthrough(descriptor);
		service.progressByEvent('onCommand:workbench.action.files.newUntitledFile');
		service.progressStep('step');
		service.deprogressStep('step');
		service.markWalkthroughOpened('walkthrough');
		assert.strictEqual(events, 0);
		assert.deepStrictEqual(service.getWalkthroughs(), []);
	});
	test('callers cannot populate the inventory by mutating a returned array', () => {
		const service = create();
		service.getWalkthroughs().push({} as never);
		assert.deepStrictEqual(service.getWalkthroughs(), []);
		service.dispose();
		service.progressStep('after-dispose');
		assert.deepStrictEqual(service.getWalkthroughs(), []);
	});
	test('does not register a command that resets user progress storage', () => {
		assert.strictEqual(CommandsRegistry.getCommand('resetGettingStartedProgress'), undefined);
	});
});
