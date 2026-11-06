/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MenuId, MenuRegistry, isIMenuItem } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { Extensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IProcessService } from '../../../../../platform/process/common/process.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { NativeIssueService } from '../../electron-browser/issueService.js';
import { IWorkbenchIssueService } from '../../common/issue.js';
import '../../electron-browser/issue.contribution.js';

suite('Myself IDE issue reporter distribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register reporter settings, capture services, menus or keybindings', () => {
		const serviceIds = ['issueFormService', 'screenshotService', 'recordingService', 'githubUploadService'];
		const ids = ['workbench.action.openIssueReporter', 'workbench.action.reportPerformanceIssueUsingReporter'];
		assert.deepStrictEqual({
			settings: Object.keys(Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties()).filter(key => key.startsWith('issueReporter.')),
			services: getSingletonServiceDescriptors().map(([id]) => id.toString()).filter(id => serviceIds.includes(id)),
			menus: [MenuId.CommandPalette, MenuId.MenubarHelpMenu].flatMap(id => MenuRegistry.getMenuItems(id)).filter(item => isIMenuItem(item) && ids.includes(item.command.id)),
			keys: KeybindingsRegistry.getDefaultKeybindings().filter(item => item.command?.startsWith('workbench.action.issueReporter.')),
			performanceAction: !!CommandsRegistry.getCommand(ids[1]),
		}, { settings: [], services: [], menus: [], keys: [], performanceAction: false });
	});

	test('keeps CLI system status delegated to the process service', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		let calls = 0;
		instantiation.stub(IProcessService, { getSystemStatus: async () => { calls++; return 'synthetic system status'; } });
		const command = CommandsRegistry.getCommand('_issues.getSystemStatus')!;
		assert.strictEqual(await instantiation.invokeFunction(command.handler), 'synthetic system status');
		assert.strictEqual(calls, 1);
	});

	test('retains API and workbench commands with an explicit unavailable result', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.stub(IWorkbenchIssueService, new NativeIssueService());
		for (const id of ['vscode.openIssueReporter', 'workbench.action.openIssueReporter']) {
			const command = CommandsRegistry.getCommand(id)!;
			await assert.rejects(async () => instantiation.invokeFunction(command.handler, 'synthetic.extension'), /issue reporter is unavailable/);
		}
	});
});
