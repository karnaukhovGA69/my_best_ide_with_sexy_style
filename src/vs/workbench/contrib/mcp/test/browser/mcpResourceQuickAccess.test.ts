/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { DefaultQuickAccessFilterValue } from '../../../../../platform/quickinput/common/quickAccess.js';
import { IQuickPick, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { McpResourceQuickAccess, McpResourceQuickPick } from '../../browser/mcpResourceQuickAccess.js';
import { IMcpServer } from '../../common/mcpTypes.js';

suite('McpResourceQuickAccess - implementation removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('scoped picker completes without resolving services or reading the server', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const server = new Proxy(upcastPartial<IMcpServer>({}), {
			get() { throw new Error('Unexpected server access'); }
		});
		const picker = instantiation.createInstance(McpResourceQuickPick, server);
		await picker.pick();
		await picker.pick(CancellationToken.Cancelled);
	});

	test('unscoped picker completes without quick input infrastructure', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		await instantiation.createInstance(McpResourceQuickPick, undefined).pick();
	});

	for (const cancelled of [false, true]) {
		test(`provider clears stale results without subscriptions (cancelled: ${cancelled})`, () => {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			const provider = instantiation.createInstance(McpResourceQuickAccess);
			const picker = upcastPartial<IQuickPick<IQuickPickItem, { useSeparators: true }>>({
				items: [{ label: 'stale MCP resource' }],
				busy: true,
				value: 'mcpr test',
				get onDidAccept(): never { throw new Error('Unexpected accept subscription'); },
				get onDidHide(): never { throw new Error('Unexpected hide subscription'); },
				get onDidTriggerItemButton(): never { throw new Error('Unexpected attachment subscription'); },
			});
			const registration = store.add(provider.provide(picker, cancelled ? CancellationToken.Cancelled : CancellationToken.None));
			registration.dispose();
			registration.dispose();
			assert.deepStrictEqual({ items: picker.items, busy: picker.busy, value: picker.value, prefix: McpResourceQuickAccess.PREFIX, filter: provider.defaultFilterValue }, {
				items: [], busy: false, value: 'mcpr test', prefix: 'mcpr ', filter: DefaultQuickAccessFilterValue.LAST,
			});
		});
	}
});
