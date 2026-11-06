/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { MCPServerActionRendering } from '../../browser/mcpCommands.js';
import { IMcpService } from '../../common/mcpTypes.js';

suite('Workbench - MCP - action rendering removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('startup contribution constructs without MCP, action view, command or configuration services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(MCPServerActionRendering));
	});

	test('construction and disposal do not register view items, inspect MCP state, change settings or allocate timers', async () => {
		const clock = sinon.useFakeTimers();
		let reads = 0;
		function unreadable<T extends object>(): T {
			return new Proxy(upcastPartial<T>({}), { get() { reads++; throw new Error('Removed action rendering dependency accessed'); } });
		}
		try {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(
				[IActionViewItemService, unreadable<IActionViewItemService>()],
				[IMcpService, unreadable<IMcpService>()],
				[ICommandService, unreadable<ICommandService>()],
				[IConfigurationService, unreadable<IConfigurationService>()],
			), true));
			const contribution = store.add(instantiation.createInstance(MCPServerActionRendering));
			await clock.tickAsync(1000);
			contribution.dispose();
			contribution.dispose();
			assert.deepStrictEqual({ reads, timers: clock.countTimers() }, { reads: 0, timers: 0 });
		} finally {
			clock.restore();
		}
	});
});
