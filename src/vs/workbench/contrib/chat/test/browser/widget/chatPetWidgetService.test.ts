/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../../base/common/event.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import type { IChatPetWidgetHost } from '../../../browser/widget/chatPetWidget.js';
import { ChatPetWidgetService } from '../../../browser/widget/chatPetWidgetService.js';

suite('ChatPetWidgetService disabled', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs without chat or widget dependencies', () => {
		const instantiationService = disposables.add(new InstantiationService(new ServiceCollection(), true));
		const service = disposables.add(instantiationService.createInstance(ChatPetWidgetService));
		assert.strictEqual(service.getFocusedJumpGame(), undefined);
	});

	test('registration never reads hosts or subscribes to focus or preferences', () => {
		const service = disposables.add(new ChatPetWidgetService());
		const host = new Proxy({} as IChatPetWidgetHost, { get: () => { throw new Error('Host must not be read'); } });
		const focus: Event<void> = () => { throw new Error('Focus must not be observed'); };
		const preferred = observableValue('preferred', true);
		const owner = {};
		const first = disposables.add(service.register(owner, host, preferred, focus));
		const second = disposables.add(service.register(owner, host, preferred, focus));
		preferred.set(false, undefined);
		preferred.set(true, undefined);
		assert.strictEqual(first.active.get(), false);
		assert.strictEqual(second.active.get(), false);
		assert.strictEqual(service.getFocusedJumpGame(), undefined);
		first.dispose();
		first.dispose();
		service.dispose();
		assert.strictEqual(second.active.get(), false);
	});
});
