/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IURLHandler } from '../../../../platform/url/common/url.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';

/** Compatibility contribution; AI plugin links do not register or perform installation. */
export class PluginUrlHandler extends Disposable implements IWorkbenchContribution, IURLHandler {
	static readonly ID = 'workbench.contrib.pluginUrlHandler';

	async handleURL(_uri: URI): Promise<boolean> {
		return false;
	}
}
