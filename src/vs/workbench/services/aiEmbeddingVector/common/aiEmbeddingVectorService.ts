/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

export const IAiEmbeddingVectorService = createDecorator<IAiEmbeddingVectorService>('IAiEmbeddingVectorService');

export interface IAiEmbeddingVectorService {
	readonly _serviceBrand: undefined;

	isEnabled(): boolean;
	getEmbeddingVector(str: string, token: CancellationToken): Promise<number[]>;
	getEmbeddingVector(strings: string[], token: CancellationToken): Promise<number[][]>;
	registerAiEmbeddingVectorProvider(model: string, provider: IAiEmbeddingVectorProvider): IDisposable;
}

export interface IAiEmbeddingVectorProvider {
	provideAiEmbeddingVector(strings: string[], token: CancellationToken): Promise<number[][]>;
}

/** Preserve both API overloads without invoking AI providers or producing placeholder vectors. */
export class AiEmbeddingVectorService implements IAiEmbeddingVectorService {
	declare readonly _serviceBrand: undefined;

	isEnabled(): boolean { return false; }

	registerAiEmbeddingVectorProvider(_model: string, _provider: IAiEmbeddingVectorProvider): IDisposable { return Disposable.None; }

	getEmbeddingVector(str: string, token: CancellationToken): Promise<number[]>;
	getEmbeddingVector(strings: string[], token: CancellationToken): Promise<number[][]>;
	async getEmbeddingVector(_strings: string | string[], _token: CancellationToken): Promise<number[] | number[][]> {
		throw new Error('AI embedding vectors are unavailable in this distribution.');
	}
}

registerSingleton(IAiEmbeddingVectorService, AiEmbeddingVectorService, InstantiationType.Delayed);
