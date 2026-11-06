/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatContextContribution } from '../../../browser/contextContrib/chatContext.contribution.js';
import { ChatContextService } from '../../../browser/contextContrib/chatContextService.js';
import { StringChatContextValue } from '../../../common/attachments/chatVariableEntries.js';
import { IChatExplicitContextProvider, IChatResourceContextProvider, IChatWorkspaceContextProvider } from '../../../common/contextContrib/chatContext.js';

suite('Chat context providers disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('creates contribution and service without activating extension or picker services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatContextContribution));
		store.add(instantiation.createInstance(ChatContextService));
	});

	test('does not collect context or invoke registered providers and commands', async () => {
		const service = store.add(new ChatContextService());
		const provider = new Proxy({} as IChatExplicitContextProvider & IChatResourceContextProvider & IChatWorkspaceContextProvider, {
			get() { throw new Error('Disabled providers must not be inspected'); },
		});
		service.setExecuteCommandCallback(async () => { throw new Error('Disabled callback must not run'); });
		service.setChatContextProvider('test', { title: 'Context', icon: ThemeIcon.fromId('file') });
		service.registerChatExplicitContextProvider('test', provider);
		service.registerChatWorkspaceContextProvider('test', provider);
		service.registerChatResourceContextProvider('test', { uri: '*' }, provider);
		service.updateWorkspaceContextItems('test', [{ handle: 1, value: 'workspace content' }]);
		assert.deepStrictEqual(service.getWorkspaceContextItems(), []);
		assert.strictEqual(await service.contextForResource(URI.file('/test/file.ts'), 'typescript'), undefined);
		assert.strictEqual(await service.contextForResource(URI.parse('test:/view'), undefined, 'test-view'), undefined);
		await service.executeChatContextItemCommand(1);
		service.unregisterChatContextProvider('test');
		assert.deepStrictEqual(service.getWorkspaceContextItems(), []);
	});

	test('preserves existing context values without resolving or mutating them', async () => {
		const service = store.add(new ChatContextService());
		for (const value of [undefined, 'previously attached content']) {
			const context: StringChatContextValue = Object.freeze({ handle: 1, name: 'saved', uri: URI.file('/test/file.ts'), value });
			assert.strictEqual(await service.resolveChatContext(context, 'typescript'), context);
		}
	});
});
