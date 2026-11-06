/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IURLHandler } from '../../../../../platform/url/common/url.js';
import { IWorkbenchContribution } from '../../../../common/contributions.js';

/** Compatibility contribution; AI links do not register handlers, download content, or open AI panels. */
export class PromptUrlHandler extends Disposable implements IWorkbenchContribution, IURLHandler {
	static readonly ID = 'workbench.contrib.promptUrlHandler';

	async handleURL(_uri: URI): Promise<boolean> {
		return false;
	}
}
