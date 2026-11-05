/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { GitHubAuthorizationContext, GitHubBootstrapClientOptions, GitHubClientOptions, GitHubRequestError, IGitHubCredentialProvider } from '../../../../../platform/github/common/githubTypes.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { WorkbenchGitHubService } from '../../browser/githubService.js';

suite('Unavailable Workbench GitHub service', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function unreadable<T>(): T {
		return upcastPartial<T>(new Proxy({}, { get() { throw new Error('Unexpected input access'); } }));
	}

	function isUnavailable(error: unknown): boolean {
		return error instanceof GitHubRequestError && error.kind === 'unknown' && error.message.includes('unavailable');
	}

	test('strict DI requires no authentication, account, network or telemetry services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = store.add(instantiation.createInstance(WorkbenchGitHubService));
		let events = 0;
		store.add(service.onDidChangeDefaultClient(() => events++));
		service.dispose();
		service.dispose();
		assert.strictEqual(events, 0);
	});

	test('sync acquisition refuses all client types without inspecting credentials or options', () => {
		const service = store.add(new WorkbenchGitHubService());
		assert.throws(() => service.acquireClient(unreadable<GitHubClientOptions>()), isUnavailable);
		assert.throws(() => service.acquireBootstrapClient(unreadable<GitHubBootstrapClientOptions>()), isUnavailable);
		assert.throws(() => service.createRequestProviderScope(unreadable<IGitHubCredentialProvider>()), isUnavailable);
		assert.throws(() => service.acquireAnonymousClient(), isUnavailable);
		assert.throws(() => service.acquireAnonymousRequestProviders(), isUnavailable);
	});

	test('async acquisition refuses without provider lookup or authentication recovery', async () => {
		const service = store.add(new WorkbenchGitHubService());
		const signal = unreadable<AbortSignal>();
		await assert.rejects(service.acquireAnonymousApiClient(signal), isUnavailable);
		await assert.rejects(service.acquireDefaultAccountClient(signal), isUnavailable);
		await assert.rejects(service.acquireDefaultAccountApiClient(signal), isUnavailable);
		await assert.rejects(service.acquireAccountApiClient(unreadable<GitHubAuthorizationContext>(), signal), isUnavailable);
		service.dispose();
		await assert.rejects(service.acquireDefaultAccountApiClient(signal), isUnavailable);
	});
});
