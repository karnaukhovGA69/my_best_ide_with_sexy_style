/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatMessage, ILanguageModelChatRequestOptions, ILanguageModelsService } from './languageModels.js';

export const IChatUtilityModelService = createDecorator<IChatUtilityModelService>('chatUtilityModelService');

/** The core feature making a utility model request, used to attribute it in logs and telemetry. */
export type ChatUtilityModelPurpose = 'thinkingTitle' | 'goalSummary' | 'toolRiskAssessment' | 'editExplanation' | 'dictationCleanup' | 'issueTitle' | 'inboxPreview' | 'inboxDetailSummary' | 'inboxContentClassification';

export interface IChatUtilityModelRequest {
	readonly purpose: ChatUtilityModelPurpose;
	/** A model identifier from {@link ILanguageModelsService.selectLanguageModels}. */
	readonly model: string;
	readonly messages: IChatMessage[];
	readonly options?: ILanguageModelChatRequestOptions;
	/** Queued behind a concurrency limit; started work finishes for caching unless it is relevance-limited. */
	readonly background?: boolean;
	/** Requests with the same key share one pending request. */
	readonly key?: string;
	/** Rechecked before sending queued work. Relevance-limited requests are cancelled when no callers remain. */
	readonly isRelevant?: () => boolean;
}

/** Compatibility interface for core utility model requests. */
export interface IChatUtilityModelService {
	readonly _serviceBrand: undefined;

	/** Resolves to response text, or `undefined` when no response is produced. */
	sendRequest(request: IChatUtilityModelRequest, token: CancellationToken): Promise<string | undefined>;
}

/** Core utility AI requests are disabled; callers receive their existing no-result outcome. */
export class ChatUtilityModelService extends Disposable implements IChatUtilityModelService {
	declare readonly _serviceBrand: undefined;

	async sendRequest(_request: IChatUtilityModelRequest, _token: CancellationToken): Promise<string | undefined> {
		return undefined;
	}
}
