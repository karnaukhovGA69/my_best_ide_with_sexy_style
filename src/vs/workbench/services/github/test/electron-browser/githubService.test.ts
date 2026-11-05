/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NativeWorkbenchGitHubService } from '../../electron-browser/githubService.js';

suite('Unavailable native Workbench GitHub service', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not need shared-process or credential broker services', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = store.add(instantiation.createInstance(NativeWorkbenchGitHubService));
		await assert.rejects(service.acquireAnonymousApiClient(new AbortController().signal), /integration is unavailable/);
		await assert.rejects(service.acquireDefaultAccountApiClient(new AbortController().signal), /integration is unavailable/);
	});
});
