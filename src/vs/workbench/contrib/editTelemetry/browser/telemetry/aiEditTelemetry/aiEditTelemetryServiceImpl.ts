/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditSuggestionId } from '../../../../../../editor/common/textModelEditSource.js';
import { IAiEditTelemetryService, IEditTelemetryCodeAcceptedData, IEditTelemetryCodeRejectedData, IEditTelemetryCodeSuggestedData } from './aiEditTelemetryService.js';

/** Keep edit identities for API consumers without constructing or collecting analytics events. */
export class AiEditTelemetryServiceImpl implements IAiEditTelemetryService {
	declare readonly _serviceBrand: undefined;

	public createSuggestionId(_data: Omit<IEditTelemetryCodeSuggestedData, 'suggestionId'>): EditSuggestionId {
		return EditSuggestionId.newId();
	}

	public handleCodeAccepted(_data: IEditTelemetryCodeAcceptedData): void { }

	public handleCodeRejected(_data: IEditTelemetryCodeRejectedData): void { }
}
