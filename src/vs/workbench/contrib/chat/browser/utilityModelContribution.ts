/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

const defaultEntryLabel = localize('chat.utilityModel.defaultEntry.label', 'Default');
const defaultEntryDescription = localize('chat.utilityModel.defaultEntry.description', "Use the default behavior for utility models");

/** Static schema compatibility; utility model enumeration is disabled. */
export class UtilityModelContribution extends Disposable {
	static readonly ID = 'workbench.contrib.utilityModel';
	static readonly modelIds: string[] = [''];
	static readonly modelLabels: string[] = [defaultEntryLabel];
	static readonly modelDescriptions: string[] = [defaultEntryDescription];
}

/** Static schema compatibility; utility model enumeration is disabled. */
export class UtilitySmallModelContribution extends Disposable {
	static readonly ID = 'workbench.contrib.utilitySmallModel';
	static readonly modelIds: string[] = [''];
	static readonly modelLabels: string[] = [defaultEntryLabel];
	static readonly modelDescriptions: string[] = [defaultEntryDescription];
}
