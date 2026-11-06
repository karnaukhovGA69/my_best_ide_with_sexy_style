/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAction } from '../../../../../base/common/actions.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../../common/contributions.js';

export const ChatModelFeedbackSurveyActionId = 'workbench.action.chat.openModelFeedbackSurvey';

export class ChatModelFeedbackSurveyActionRendering extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'chat.modelFeedbackSurveyActionRendering';
}

/** The part of a toolbar needed to find and focus one of its actions. */
export interface IFeedbackSurveyToolBar {
	getItemsLength(): number;
	getItemAction(index: number): IAction | undefined;
	focus(index?: number): void;
}

/**
 * Puts focus on the feedback control in `toolbar`, used when the survey panel it opened is torn
 * down. Falls back to the toolbar itself when the control is not currently shown.
 */
export function focusChatModelFeedbackSurveyAction(toolbar: IFeedbackSurveyToolBar): void {
	for (let i = 0; i < toolbar.getItemsLength(); i++) {
		if (toolbar.getItemAction(i)?.id === ChatModelFeedbackSurveyActionId) {
			toolbar.focus(i);
			return;
		}
	}
	toolbar.focus();
}

export function registerChatModelFeedbackSurveyActions(): void {
	// Built-in feedback surveys do not register commands, menus or action renderers.
}
