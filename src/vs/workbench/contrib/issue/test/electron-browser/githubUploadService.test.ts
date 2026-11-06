/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { BrowserGitHubUploadService } from '../../browser/githubUploadService.js';
import { NativeGitHubUploadService } from '../../electron-browser/nativeGitHubUploadService.js';

suite('Myself IDE unavailable GitHub uploads', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const ctor of [BrowserGitHubUploadService, NativeGitHubUploadService]) {
		test(`${ctor.name} requires no network or native host dependencies`, () => {
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			assert.ok(instantiation.createInstance(ctor));
		});

		test(`${ctor.name} refuses lookup and upload without inspecting files`, async () => {
			const service = new ctor();
			const text = 'synthetic-test-value';
			const files = new Proxy<{ name: string; bytes: Uint8Array; contentType: string }[]>([], { get() { throw new Error('Unexpected file access'); } });
			await assert.rejects(service.resolveRepositoryId(text, text, text), /GitHub uploads are unavailable/);
			await assert.rejects(service.uploadViaMobileApi(text, text, files), /GitHub uploads are unavailable/);
		});
	}
});
