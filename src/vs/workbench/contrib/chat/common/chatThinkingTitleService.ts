/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { StringSHA1 } from '../../../../base/common/hash.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isObject } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { chatSessionResourceToId } from './model/chatUri.js';

export const IChatThinkingTitleService = createDecorator<IChatThinkingTitleService>('chatThinkingTitleService');

export interface IChatThinkingTitleRequest {
	readonly sessionResource: URI;
	readonly content: string;
	readonly legacyId?: string;
	readonly isValidTitle?: (title: string) => boolean;
}

export interface IChatThinkingTitleService {
	readonly _serviceBrand: undefined;
	getCachedTitle(request: IChatThinkingTitleRequest): string | undefined;
	generateTitle(request: IChatThinkingTitleRequest, isRelevant: () => boolean, token: CancellationToken): Promise<string | undefined>;
}

interface IThinkingTitleCacheEntry {
	readonly title: string;
	readonly storedAt: number;
}

const cacheStorageKey = 'chat.thinkingTitleCache';
const cacheTtlMs = 7 * 24 * 60 * 60 * 1000;

/** Reads previously stored titles; AI generation and cache writes are disabled. */
export class ChatThinkingTitleService extends Disposable implements IChatThinkingTitleService {
	declare readonly _serviceBrand: undefined;
	private cache: Map<string, IThinkingTitleCacheEntry> | undefined;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._register(storageService.onDidChangeValue(StorageScope.PROFILE, cacheStorageKey, this._store)(event => {
			if (event.external) {
				this.cache = undefined;
			}
		}));
	}

	getCachedTitle(request: IChatThinkingTitleRequest): string | undefined {
		const cache = this.load();
		const cached = cache.get(this.getCacheKey(request)) ?? (request.legacyId ? cache.get(`${chatSessionResourceToId(request.sessionResource)}:${request.legacyId}`) : undefined);
		return cached && Date.now() - cached.storedAt <= cacheTtlMs && (!request.isValidTitle || request.isValidTitle(cached.title)) ? cached.title : undefined;
	}

	async generateTitle(request: IChatThinkingTitleRequest, isRelevant: () => boolean, token: CancellationToken): Promise<string | undefined> {
		if (token.isCancellationRequested || !isRelevant() || this._store.isDisposed) {
			return undefined;
		}
		return this.getCachedTitle(request);
	}

	private getCacheKey(request: IChatThinkingTitleRequest): string {
		const hash = new StringSHA1();
		hash.update(request.content.slice(0, 2000));
		return `${chatSessionResourceToId(request.sessionResource)}:thinking:${hash.digest()}`;
	}

	private load(): Map<string, IThinkingTitleCacheEntry> {
		if (!this.cache) {
			this.cache = new Map();
			const now = Date.now();
			const stored = this.storageService.getObject<Record<string, { title?: unknown; storedAt?: unknown }>>(cacheStorageKey, StorageScope.PROFILE, {});
			if (!isObject(stored)) {
				this.logService.warn('[ChatThinkingTitle] Ignoring an invalid persisted title cache');
			} else {
				for (const [key, value] of Object.entries(stored)) {
					if (!isObject(value) || typeof value.title !== 'string' || typeof value.storedAt !== 'number' || !Number.isFinite(value.storedAt)) {
						this.logService.warn('[ChatThinkingTitle] Ignoring an invalid persisted title entry');
						continue;
					}
					if (now - value.storedAt <= cacheTtlMs) {
						this.cache.set(key, { title: value.title, storedAt: value.storedAt });
					}
				}
			}
		}
		return this.cache;
	}

}
