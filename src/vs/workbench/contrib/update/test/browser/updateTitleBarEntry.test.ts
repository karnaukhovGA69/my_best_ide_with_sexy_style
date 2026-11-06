/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isMacintosh, isWeb } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpression } from '../../../../../platform/contextkey/common/contextkey.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { InEditorZenModeContext } from '../../../../common/contextkeys.js';
import { getAdditionalUpdateTitleBarMenuWhen } from '../../browser/updateTitleBarEntry.js';
import { UpdateGlobalActivityBadgeVisibleContext, UpdateTitleBarChatInProgressContext, UpdateTitleBarContext, UpdateTitleBarEditorVisibleContext } from '../../common/update.js';

class TestContextKeyService extends MockContextKeyService {
	override contextMatchesRules(rules: ContextKeyExpression): boolean {
		return rules.evaluate({ getValue: key => this.getContextKeyValue(key) });
	}
}

suite('Removed update title bar', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register the update indicator action or menu', () => {
		assert.strictEqual(CommandsRegistry.getCommand('workbench.actions.updateIndicator'), undefined);
		assert.strictEqual(MenuRegistry.getMenuItems(MenuId.TitleBarUpdate).some(item => isIMenuItem(item) && item.command.id === 'workbench.actions.updateIndicator'), false);
	});
});

suite('UpdateGlobalActivityBadgeVisibleContext', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hides the badge when the Update and Manage actions are adjacent', () => {
		const customMenuBarCanBeHidden = !isMacintosh || isWeb;
		const scenarios = [
			{ name: 'no update', updateVisible: false, menuBarVisibility: 'visible', activityBarLocation: 'top', expected: true },
			{ name: 'adjacent', updateVisible: true, menuBarVisibility: 'visible', activityBarLocation: 'top', expected: false },
			{ name: 'classic menu', updateVisible: true, menuBarVisibility: 'classic', activityBarLocation: 'top', expected: false },
			{ name: 'hidden menu', updateVisible: true, menuBarVisibility: 'hidden', activityBarLocation: 'top', expected: customMenuBarCanBeHidden },
			{ name: 'toggle menu', updateVisible: true, menuBarVisibility: 'toggle', activityBarLocation: 'top', expected: customMenuBarCanBeHidden },
			{ name: 'compact menu', updateVisible: true, menuBarVisibility: 'compact', activityBarLocation: 'top', expected: customMenuBarCanBeHidden },
			{ name: 'bottom activity bar', updateVisible: true, menuBarVisibility: 'visible', activityBarLocation: 'bottom', expected: true },
			{ name: 'chat in progress', updateVisible: true, menuBarVisibility: 'visible', activityBarLocation: 'top', chatInProgress: true, expected: true },
		];

		const actual = scenarios.map(scenario => {
			const contextKeyService = new TestContextKeyService();
			UpdateTitleBarContext.bindTo(contextKeyService).set(scenario.updateVisible);
			UpdateTitleBarChatInProgressContext.bindTo(contextKeyService).set(scenario.chatInProgress ?? false);
			InEditorZenModeContext.bindTo(contextKeyService);
			contextKeyService.createKey('config.window.menuBarVisibility', scenario.menuBarVisibility);
			contextKeyService.createKey('config.workbench.activityBar.location', scenario.activityBarLocation);

			return {
				name: scenario.name,
				visible: contextKeyService.contextMatchesRules(UpdateGlobalActivityBadgeVisibleContext),
			};
		});

		assert.deepStrictEqual(actual, scenarios.map(({ name, expected }) => ({ name, visible: expected })));
	});
});

suite('UpdateTitleBarVisibleContexts', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shows an additional placement during an active chat while the editor hides it', () => {
		const contextKeyService = new TestContextKeyService();
		UpdateTitleBarContext.bindTo(contextKeyService).set(true);
		UpdateTitleBarChatInProgressContext.bindTo(contextKeyService).set(true);
		InEditorZenModeContext.bindTo(contextKeyService).set(false);
		contextKeyService.createKey('inDebugMode', false);

		assert.deepStrictEqual({
			additional: contextKeyService.contextMatchesRules(getAdditionalUpdateTitleBarMenuWhen()),
			editor: contextKeyService.contextMatchesRules(UpdateTitleBarEditorVisibleContext),
		}, {
			additional: true,
			editor: false,
		});
	});
});
