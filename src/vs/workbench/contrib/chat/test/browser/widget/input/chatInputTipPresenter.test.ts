/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../../platform/instantiation/common/serviceCollection.js';
import { CommandsRegistry } from '../../../../../../../platform/commands/common/commands.js';
import type { ChatInputNoticeHost } from '../../../../browser/widget/input/chatInputNoticeHost.js';
import { ChatInputTipPresenter } from '../../../../browser/widget/input/chatInputTipPresenter.js';

suite('Chat tip presentation disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('leaves the input slot empty without services, notice leases or callbacks', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const container = mainWindow.document.createElement('div');
		const fail = () => { throw new Error('Tip callback must not be called'); };
		const host = new Proxy({} as ChatInputNoticeHost, { get: fail });
		const presenter = store.add(instantiation.createInstance(ChatInputTipPresenter, { container, isEligible: fail, focusInput: fail, onBeforeUpdate: fail }, host));
		presenter.update();
		presenter.clear();
		presenter.update();
		presenter.dispose();
		assert.strictEqual(presenter.current, undefined);
		assert.strictEqual(container.childElementCount, 0);
		assert.strictEqual(container.classList.contains('chat-input-stack-docked'), false);
	});

	test('does not register chat tip commands', () => {
		for (const suffix of ['previousTip', 'nextTip', 'dismissTipToolbar', 'dismissTip', 'disableTips', 'resetDismissedTips']) {
			assert.strictEqual(CommandsRegistry.getCommand(`workbench.action.chat.${suffix}`), undefined);
		}
	});
});
