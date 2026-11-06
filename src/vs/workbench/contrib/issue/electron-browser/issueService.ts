/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IssueReporterData, IWorkbenchIssueService } from '../common/issue.js';

export class NativeIssueService implements IWorkbenchIssueService {
	declare readonly _serviceBrand: undefined;

	async openReporter(_options?: Partial<IssueReporterData>): Promise<void> {
		throw new Error(localize('issueReporterUnavailable', "The built-in issue reporter is unavailable in Myself IDE."));
	}
}

registerSingleton(IWorkbenchIssueService, NativeIssueService, InstantiationType.Delayed);
