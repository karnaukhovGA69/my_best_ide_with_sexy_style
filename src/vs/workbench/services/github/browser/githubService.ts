/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable, IReference } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IGitHubAccountClient } from '../../../../platform/github/common/account/account.js';
import { IGitHubAnonymousClient } from '../../../../platform/github/common/anonymous/anonymous.js';
import { ApiRequestProviders, IGitHubBootstrapClient, IGitHubClient, IGitHubRequestProviderScope } from '../../../../platform/github/common/githubService.js';
import { GitHubAuthorizationContext, GitHubBootstrapClientOptions, GitHubClientOptions, GitHubRequestError, IGitHubCredentialProvider } from '../../../../platform/github/common/githubTypes.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchGitHubService } from '../common/githubService.js';

/** Compatibility boundary for removed built-in GitHub integration. */
export class WorkbenchGitHubService extends Disposable implements IWorkbenchGitHubService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeDefaultClient: Event<void> = Event.None;

	acquireClient(_options: GitHubClientOptions): IReference<IGitHubClient> { throw unavailable(); }
	acquireAnonymousClient(): IGitHubAnonymousClient { throw unavailable(); }
	acquireAnonymousRequestProviders(): IReference<ApiRequestProviders> { throw unavailable(); }
	createRequestProviderScope(_credentialProvider: IGitHubCredentialProvider): IGitHubRequestProviderScope { throw unavailable(); }
	acquireBootstrapClient(_options: GitHubBootstrapClientOptions): IReference<IGitHubBootstrapClient> { throw unavailable(); }

	async acquireAnonymousApiClient(_signal: AbortSignal): Promise<IGitHubAnonymousClient> { throw unavailable(); }
	async acquireAccountApiClient(_authorization: GitHubAuthorizationContext, _signal: AbortSignal): Promise<IGitHubAccountClient> { throw unavailable(); }
	async acquireDefaultAccountClient(_signal: AbortSignal): Promise<IReference<IGitHubClient>> { throw unavailable(); }
	async acquireDefaultAccountApiClient(_signal: AbortSignal): Promise<IGitHubAccountClient> { throw unavailable(); }
}

function unavailable(): GitHubRequestError {
	// Do not classify this as an authentication error: signing in cannot enable the feature.
	return new GitHubRequestError(localize('githubUnavailable', "Built-in GitHub integration is unavailable in Myself IDE."), 'unknown');
}

registerSingleton(IWorkbenchGitHubService, WorkbenchGitHubService, InstantiationType.Delayed);
