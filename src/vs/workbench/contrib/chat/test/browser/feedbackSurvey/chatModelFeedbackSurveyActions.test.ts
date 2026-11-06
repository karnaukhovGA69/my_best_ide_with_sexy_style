/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { MenuId, MenuRegistry, isIMenuItem } from '../../../../../../platform/actions/common/actions.js';
import { IAction } from '../../../../../../base/common/actions.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ChatModelFeedbackSurveyActionRendering, registerChatModelFeedbackSurveyActions, ChatModelFeedbackSurveyActionId, focusChatModelFeedbackSurveyAction, IFeedbackSurveyToolBar } from '../../../browser/actions/chatModelFeedbackSurveyActions.js';

suite('ChatModelFeedbackSurveyActions', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createToolBar(actionIds: readonly string[]): IFeedbackSurveyToolBar & { focused: number | undefined } {
		return {
			focused: undefined,
			getItemsLength: () => actionIds.length,
			getItemAction: (index: number) => ({ id: actionIds[index] } as IAction),
			focus(index?: number) { this.focused = index; },
		};
	}

	test('focuses the feedback control rather than whichever action comes first', () => {
		// The copy action sits before the survey control in the response footer.
		const toolbar = createToolBar(['workbench.action.chat.copyItem', ChatModelFeedbackSurveyActionId, 'workbench.action.chat.reportIssueForBug']);

		focusChatModelFeedbackSurveyAction(toolbar);

		assert.strictEqual(toolbar.focused, 1);
	});

	test('falls back to the toolbar when the control is not shown', () => {
		const toolbar = createToolBar(['workbench.action.chat.copyItem']);

		focusChatModelFeedbackSurveyAction(toolbar);

		assert.strictEqual(toolbar.focused, undefined);
	});
	test('does not register commands or feedback menu entries', () => {
		registerChatModelFeedbackSurveyActions();
		registerChatModelFeedbackSurveyActions();
		assert.strictEqual(CommandsRegistry.getCommand(ChatModelFeedbackSurveyActionId), undefined);
		assert.strictEqual(MenuRegistry.getMenuItems(MenuId.ChatMessageFooter).some(item => isIMenuItem(item) && item.command.id === ChatModelFeedbackSurveyActionId), false);
	});

	test('does not require action rendering or instantiation services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatModelFeedbackSurveyActionRendering));
	});

});
