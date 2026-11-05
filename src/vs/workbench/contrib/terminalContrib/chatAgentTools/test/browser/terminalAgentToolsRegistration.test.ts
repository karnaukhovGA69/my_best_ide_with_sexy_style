/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ShellIntegrationTimeoutMigrationContribution } from '../../browser/terminal.chatAgentTools.contribution.js';
import { ConfigurationTarget, IConfigurationValue } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TerminalSettingId } from '../../../../../../platform/terminal/common/terminal.js';
import { TerminalChatAgentToolsSettingId } from '../../common/terminalChatAgentToolsConfiguration.js';
import { stub } from 'sinon';
import '../../browser/tools/sendToTerminalTool.js';
import '../../../../chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { getSingletonServiceDescriptors } from '../../../../../../platform/instantiation/common/extensions.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ITerminalSandboxService, TerminalSandboxService } from '../../common/terminalSandboxService.js';

suite('Myself IDE terminal AI registrations', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('loading tools and shared chat rendering does not register terminal AI commands', () => {
		const removedCommands = [
			'focusChatInstance',
			'continueInBackground',
			'toggleChatTerminalOutput',
			'focusTerminalById',
			'focusTerminalByExecutionId',
			'addTerminalSelection',
		].map(name => `workbench.action.terminal.chat.${name}`);
		assert.deepStrictEqual(removedCommands.filter(id => CommandsRegistry.getCommand(id)), []);
	});

	test('keeps the real sandbox service available for shared consumers', () => {
		const registration = getSingletonServiceDescriptors().find(([id]) => id === ITerminalSandboxService);
		assert.deepStrictEqual(
			[registration?.[1].ctor, registration?.[1].supportsDelayedInstantiation],
			[TerminalSandboxService, true],
		);
	});

	interface MigrationCase {
		name: string;
		deprecated: IConfigurationValue<number | string | boolean | null>;
		target: IConfigurationValue<number>;
		expected: [string, number, ConfigurationTarget][];
	}

	const timeoutKey = TerminalSettingId.ShellIntegrationTimeout;
	const cases: MigrationCase[] = [
		{
			name: 'migrates user and workspace timeouts into their original scopes',
			deprecated: { userValue: 1200, workspaceValue: 2400 },
			target: {},
			expected: [[timeoutKey, 1200, ConfigurationTarget.USER], [timeoutKey, 2400, ConfigurationTarget.WORKSPACE]],
		},
		{
			name: 'preserves explicit timeouts including zero',
			deprecated: { userValue: 1200, workspaceValue: 2400 },
			target: { userValue: 0, workspaceValue: 3600 },
			expected: [],
		},
		{
			name: 'migrates workspace timeout without replacing an explicit user timeout',
			deprecated: { userValue: 1200, workspaceValue: 2400 },
			target: { userValue: 3600 },
			expected: [[timeoutKey, 2400, ConfigurationTarget.WORKSPACE]],
		},
		{
			name: 'migrates user timeout without replacing an explicit workspace timeout',
			deprecated: { userValue: 1200, workspaceValue: 2400 },
			target: { workspaceValue: 3600 },
			expected: [[timeoutKey, 1200, ConfigurationTarget.USER]],
		},
		{
			name: 'migrates a zero timeout despite inherited defaults',
			deprecated: { userValue: 0, workspaceValue: 0 },
			target: { defaultValue: 5000, value: 5000 },
			expected: [[timeoutKey, 0, ConfigurationTarget.USER], [timeoutKey, 0, ConfigurationTarget.WORKSPACE]],
		},
		{
			name: 'does not persist inherited legacy defaults',
			deprecated: { defaultValue: 5000, value: 5000 },
			target: {},
			expected: [],
		},
		{
			name: 'ignores legacy string and boolean values',
			deprecated: { userValue: '1200', workspaceValue: false },
			target: {},
			expected: [],
		},
		{
			name: 'ignores a null legacy value without losing a valid workspace timeout',
			deprecated: { userValue: null, workspaceValue: 2400 },
			target: {},
			expected: [[timeoutKey, 2400, ConfigurationTarget.WORKSPACE]],
		},
	];

	for (const { name, deprecated, target, expected } of cases) {
		test(name, () => {
			const configurationService = new TestConfigurationService();
			store.add(configurationService.onDidChangeConfigurationEmitter);
			const inspect = stub(configurationService, 'inspect');
			inspect.withArgs(TerminalChatAgentToolsSettingId.ShellIntegrationTimeout).returns(deprecated);
			inspect.withArgs(timeoutKey).returns(target);
			const update = stub(configurationService, 'updateValue').resolves();

			store.add(new ShellIntegrationTimeoutMigrationContribution(configurationService));

			assert.deepStrictEqual(update.args, expected);
		});
	}
});
