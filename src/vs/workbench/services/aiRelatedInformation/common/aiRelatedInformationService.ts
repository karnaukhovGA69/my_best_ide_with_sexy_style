/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAiRelatedInformationService, IAiRelatedInformationProvider, RelatedInformationType, RelatedInformationResult } from './aiRelatedInformation.js';

/** Preserve the API boundary without invoking AI providers. */
export class AiRelatedInformationService implements IAiRelatedInformationService {
	declare readonly _serviceBrand: undefined;

	isEnabled(): boolean { return false; }

	registerAiRelatedInformationProvider(_type: RelatedInformationType, _provider: IAiRelatedInformationProvider): IDisposable { return Disposable.None; }

	async getRelatedInformation(_query: string, _types: RelatedInformationType[], _token: CancellationToken): Promise<RelatedInformationResult[]> {
		throw new Error('AI related information is unavailable in this distribution.');
	}
}

registerSingleton(IAiRelatedInformationService, AiRelatedInformationService, InstantiationType.Delayed);
