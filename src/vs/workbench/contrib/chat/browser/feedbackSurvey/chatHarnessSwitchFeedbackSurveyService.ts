/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import type { CopilotHarnessIntroductionMode } from '../../common/constants.js';

export interface IChatHarnessSwitchFeedbackSurveyContext {
	readonly mode: CopilotHarnessIntroductionMode;
	readonly surface: 'sidebar' | 'editor';
	readonly chatSessionId: string | undefined;
	readonly sessionType: string | undefined;
	readonly harness: string | undefined;
}

export const IChatHarnessSwitchFeedbackSurveyService = createDecorator<IChatHarnessSwitchFeedbackSurveyService>('chatHarnessSwitchFeedbackSurveyService');

export interface IChatHarnessSwitchFeedbackSurveyService {
	readonly _serviceBrand: undefined;

	/** Compatibility call; built-in feedback surveys are disabled. */
	prompt(inputUri: URI, context: IChatHarnessSwitchFeedbackSurveyContext): void;
}


export class ChatHarnessSwitchFeedbackSurveyService extends Disposable implements IChatHarnessSwitchFeedbackSurveyService {
	declare readonly _serviceBrand: undefined;

	prompt(_inputUri: URI, _context: IChatHarnessSwitchFeedbackSurveyContext): void {
		// Built-in surveys do not render UI, observe chat, persist state or report telemetry.
	}
}
