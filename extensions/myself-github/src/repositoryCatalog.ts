/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RepositoryIdentity, validateRepository } from './repositoryIdentity';

export interface CatalogRepository extends RepositoryIdentity {
	readonly id: number;
	readonly private: boolean;
	readonly description: string;
}

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class CatalogError extends Error {
	constructor(readonly status: number) {
		// Never include response bodies, headers, URLs containing tokens, or server-supplied text.
		super(`GitHub catalog request failed (${status})`);
	}
}

export class RepositoryCatalog {
	constructor(private readonly request: typeof fetch = fetch) { }

	/** Called only by explicit refresh/load-more actions; does not follow API-provided resource URLs. */
	async page(token: string, page: number, signal: AbortSignal): Promise<{ repositories: CatalogRepository[]; hasMore: boolean }> {
		if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !token || /[\r\n]/.test(token)) {
			throw new Error('Invalid catalog request');
		}
		signal.throwIfAborted();
		const response = await this.request(`https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member&sort=full_name&direction=asc`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
			redirect: 'error',
			signal: AbortSignal.any([signal, AbortSignal.timeout(30000)])
		});
		if (!response.ok) {
			await response.body?.cancel();
			throw new CatalogError(response.status);
		}
		// Bound actual streamed bytes, not only an untrusted Content-Length header.
		if (!response.body) { throw new CatalogError(502); }
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let length = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) { break; }
				length += value.byteLength;
				if (length > 4 * 1024 * 1024) { throw new CatalogError(502); }
				chunks.push(value);
			}
		} finally {
			await reader.cancel();
			reader.releaseLock();
		}
		signal.throwIfAborted();
		let data: unknown;
		try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new CatalogError(502); }
		if (!Array.isArray(data) || data.length > 100) { throw new CatalogError(502); }
		const repositories: CatalogRepository[] = [];
		for (const item of data) {
			if (!object(item) || !object(item.owner) || typeof item.owner.login !== 'string' || typeof item.name !== 'string'
				|| typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.private !== 'boolean') {
				throw new CatalogError(502);
			}
			const identity = { owner: item.owner.login, name: item.name };
			try { validateRepository(identity); } catch { throw new CatalogError(502); }
			repositories.push({ ...identity, id: item.id, private: item.private, description: typeof item.description === 'string' ? item.description.slice(0, 1000) : '' });
		}
		return { repositories, hasMore: data.length === 100 };
	}
}
