/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatFollowups } from '../../../../browser/widget/input/chatFollowups.js';
import type { IChatFollowup } from '../../../../common/chatService/chatService.js';
import { ChatAgentLocation } from '../../../../common/constants.js';

suite('Chat followup renderer disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	test('does not inspect followups, render buttons or require an agent service', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const container = mainWindow.document.createElement('div');
		const existing = container.appendChild(mainWindow.document.createElement('span'));
		const fail = () => { throw new Error('Followups must not be accessed or dispatched'); };
		const items = new Proxy([] as IChatFollowup[], { get: fail });
		store.add(instantiation.createInstance(ChatFollowups, container, items, ChatAgentLocation.Chat, undefined, fail));
		container.click();
		assert.deepStrictEqual([...container.children], [existing]);
	});
});
