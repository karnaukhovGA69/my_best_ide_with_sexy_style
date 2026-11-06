/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface IGitHubUploadResult {
	readonly fileName: string;
	readonly assetUrl: string;
	readonly contentType: string;
}

export const IGitHubUploadService = createDecorator<IGitHubUploadService>('githubUploadService');

export interface IGitHubUploadService {
	readonly _serviceBrand: undefined;
	resolveRepositoryId(owner: string, repo: string, token?: string): Promise<string>;
	uploadViaMobileApi(token: string, repoId: string, files: { name: string; bytes: Uint8Array; contentType: string }[]): Promise<IGitHubUploadResult[]>;
}

/**
 * Compatibility adapter for the disabled built-in GitHub upload feature.
 */
export class BrowserGitHubUploadService implements IGitHubUploadService {
	readonly _serviceBrand: undefined;

	async resolveRepositoryId(_owner: string, _repo: string, _token?: string): Promise<string> {
		throw new Error(localize('githubUploadUnavailable', "Built-in GitHub uploads are unavailable in Myself IDE."));
	}
	async uploadViaMobileApi(_token: string, _repoId: string, _files: { name: string; bytes: Uint8Array; contentType: string }[]): Promise<IGitHubUploadResult[]> {
		throw new Error(localize('githubUploadUnavailable', "Built-in GitHub uploads are unavailable in Myself IDE."));
	}
}
