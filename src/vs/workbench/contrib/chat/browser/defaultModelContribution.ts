/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

export interface DefaultModelArrays {
	readonly modelIds: string[];
	readonly modelLabels: string[];
	readonly modelDescriptions: string[];
}

/** Static defaults retained for existing configuration schemas. */
export function createDefaultModelArrays(defaultEntryLabel?: string, defaultEntryDescription?: string): DefaultModelArrays {
	return {
		modelIds: [''],
		modelLabels: [defaultEntryLabel ?? localize('defaultModel', 'Auto (Vendor Default)')],
		modelDescriptions: [defaultEntryDescription ?? localize('defaultModelDescription', "Use the vendor's default model")],
	};
}
