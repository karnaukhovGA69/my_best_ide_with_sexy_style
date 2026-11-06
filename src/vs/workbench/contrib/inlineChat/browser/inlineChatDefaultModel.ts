/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDefaultModelArrays } from '../../chat/browser/defaultModelContribution.js';

const arrays = createDefaultModelArrays();

/** Static schema compatibility; AI model enumeration is disabled. */
export class InlineChatDefaultModel extends Disposable {
	static readonly ID = 'workbench.contrib.inlineChatDefaultModel';
	static readonly modelIds = arrays.modelIds;
	static readonly modelLabels = arrays.modelLabels;
	static readonly modelDescriptions = arrays.modelDescriptions;
}
