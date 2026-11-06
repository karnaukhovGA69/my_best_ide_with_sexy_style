/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatTipService, IChatTipProvider } from '../../browser/chatTipService.js';

suite('Chat tips disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs without tracking, storage, experiments or chat dependencies', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatTipService));
	});

	test('does not read providers or context to offer tips', () => {
		const service = store.add(new ChatTipService());
		const provider = new Proxy({} as IChatTipProvider, { get: () => { throw new Error('Provider must not be read'); } });
		const context = new Proxy({} as IContextKeyService, { get: () => { throw new Error('Context must not be read'); } });
		store.add(service.registerTipProvider(provider));
		assert.strictEqual(service.getWelcomeTip(context), undefined);
		assert.strictEqual(service.navigateToNextTip(), undefined);
		assert.strictEqual(service.navigateToPreviousTip(), undefined);
		assert.strictEqual(service.getNextEligibleTip(), undefined);
		assert.strictEqual(service.hasMultipleTips(), false);
	});

	test('state and usage methods do not emit or require settings or storage', async () => {
		const service = store.add(new ChatTipService());
		let events = 0;
		store.add(service.onDidDismissTip(() => events++));
		store.add(service.onDidNavigateTip(() => events++));
		store.add(service.onDidHideTip(() => events++));
		store.add(service.onDidDisableTips(() => events++));
		store.add(service.onDidChangeTip(() => events++));
		service.resetSession();
		service.dismissTip();
		service.dismissTipForSession();
		service.hideTip();
		service.hideTipsForSession();
		service.recordSlashCommandUsage('create-agent');
		service.clearDismissedTips();
		await service.disableTips();
		assert.strictEqual(events, 0);
	});
});
