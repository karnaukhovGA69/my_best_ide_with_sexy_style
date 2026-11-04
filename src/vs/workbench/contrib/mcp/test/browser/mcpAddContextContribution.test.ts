/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Codicon } from '../../../../../base/common/codicons.js';
import { derived, observableValue } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatContextPickService, IChatContextPickService, IChatContextValueItem } from '../../../chat/browser/attachments/chatContextPickService.js';
import { McpAddContextContribution } from '../../browser/mcpAddContextContribution.js';
import { IMcpServer, IMcpService, McpCapability } from '../../common/mcpTypes.js';

suite('Workbench - MCP - Add context removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('startup and disposal require no infrastructure services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const contribution = store.add(instantiation.createInstance(McpAddContextContribution));
		contribution.dispose();
		contribution.dispose();
	});

	for (const capability of [undefined, McpCapability.Resources, McpCapability.Tools]) {
		test(`does not add MCP context for capability ${capability}`, () => {
			const calls: string[] = [];
			const picker = new ChatContextPickService();
			const ordinary: IChatContextValueItem = {
				type: 'valuePick', label: 'Test attachment', icon: Codicon.file, asAttachment: async () => undefined,
			};
			store.add(picker.registerChatContextItem(ordinary));
			const capabilities = observableValue<McpCapability | undefined>('capabilities', capability);
			const server = upcastPartial<IMcpServer>({ capabilities });
			const servers = observableValue<readonly IMcpServer[]>('servers', [server]);
			const instantiation = store.add(new InstantiationService(new ServiceCollection(
				[IChatContextPickService, picker],
				[IMcpService, upcastPartial<IMcpService>({ servers: derived(reader => {
					calls.push('read servers');
					return servers.read(reader);
				}) })],
			), true));
			const contribution = store.add(instantiation.createInstance(McpAddContextContribution));
			const initial = [...picker.items];
			servers.set([], undefined);
			capabilities.set(McpCapability.Resources, undefined);
			servers.set([server], undefined);
			const updated = [...picker.items];
			contribution.dispose();
			servers.set([], undefined);
			assert.deepStrictEqual({ initial, updated, disposed: [...picker.items], calls }, {
				initial: [ordinary], updated: [ordinary], disposed: [ordinary], calls: [],
			});
		});
	}
});
