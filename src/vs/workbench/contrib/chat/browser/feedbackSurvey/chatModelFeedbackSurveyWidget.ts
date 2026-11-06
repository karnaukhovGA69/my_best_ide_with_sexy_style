/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import type { IChatResponseViewModel } from '../../common/model/chatViewModel.js';

/** Retained for chat row construction while built-in surveys are removed. */
export class ChatModelFeedbackSurveyWidget extends Disposable {
	constructor(container: HTMLElement, _restoreFocus: () => void) {
		super();
		container.hidden = true;
	}

	render(_response: IChatResponseViewModel | undefined): void {
		// No response data, survey state, keyboard events or focus are observed.
	}
}
