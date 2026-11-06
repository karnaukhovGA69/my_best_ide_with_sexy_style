/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { BrowserIssueService } from '../../browser/issueService.js';
import { NativeIssueService } from '../../electron-browser/issueService.js';
import { IssueReporterData } from '../../common/issue.js';

suite('Myself IDE unavailable issue reporter', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const ctor of [BrowserIssueService, NativeIssueService]) {
		test(`${ctor.name} requires no authentication, diagnostics, or window services`, () => {
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			assert.ok(instantiation.createInstance(ctor));
		});

		test(`${ctor.name} refuses launch without reading caller data`, async () => {
			const service = new ctor();
			const options = upcastPartial<IssueReporterData>(new Proxy({}, { get() { throw new Error('Unexpected caller data access'); } }));
			await assert.rejects(service.openReporter(options), /issue reporter is unavailable/);
			await assert.rejects(service.openReporter(), /issue reporter is unavailable/);
		});
	}
});
