/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IChatGoalSummaryService = createDecorator<IChatGoalSummaryService>('chatGoalSummaryService');

export interface IChatGoalSummaryService {
	readonly _serviceBrand: undefined;

	/** Returns undefined when no goal summary is produced. */
	summarize(prompt: string, token: CancellationToken): Promise<string | undefined>;
}

/** Compatibility service; background AI goal summaries are disabled. */
export class ChatGoalSummaryService implements IChatGoalSummaryService {
	declare readonly _serviceBrand: undefined;

	async summarize(_prompt: string, _token: CancellationToken): Promise<string | undefined> {
		return undefined;
	}
}
