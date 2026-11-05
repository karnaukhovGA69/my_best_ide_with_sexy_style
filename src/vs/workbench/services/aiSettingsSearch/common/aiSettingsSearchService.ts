/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AiSettingsSearchResult, IAiSettingsSearchProvider, IAiSettingsSearchService } from './aiSettingsSearch.js';

/** Compatibility facade: settings search in this distribution uses the ordinary local search. */
export class AiSettingsSearchService extends Disposable implements IAiSettingsSearchService {
	declare readonly _serviceBrand: undefined;
	readonly onProviderRegistered = Event.None;

	isEnabled(): boolean { return false; }

	registerSettingsSearchProvider(_provider: IAiSettingsSearchProvider): IDisposable { return Disposable.None; }

	startSearch(_query: string, _token: CancellationToken): void { }

	async getEmbeddingsResults(_query: string, _token: CancellationToken): Promise<string[] | null> { return null; }

	async getLLMRankedResults(_query: string, _token: CancellationToken): Promise<string[] | null> { return null; }

	handleSearchResult(_result: AiSettingsSearchResult): void { }
}

registerSingleton(IAiSettingsSearchService, AiSettingsSearchService, InstantiationType.Delayed);
