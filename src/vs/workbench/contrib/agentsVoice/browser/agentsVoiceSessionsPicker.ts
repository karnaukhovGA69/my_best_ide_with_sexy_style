/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

/** Compatibility picker: voice session selection is unavailable in this fork. */
export class AgentsVoiceSessionsPicker {
	constructor(_onSelectTarget: (resource: URI) => void) { }

	async show(): Promise<void> { }
}
