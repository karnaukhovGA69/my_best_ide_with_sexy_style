/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const ICustomizationsTelemetryService = createDecorator<ICustomizationsTelemetryService>('customizationsTelemetryService');

export interface ICustomizationsTelemetryService {
	readonly _serviceBrand: undefined;
	reportNewSession(sessionResource: URI): void;
}

export class CustomizationsTelemetryService implements ICustomizationsTelemetryService {
	declare readonly _serviceBrand: undefined;
	reportNewSession(_sessionResource: URI): void { }
}

export class CustomizationsTelemetryContribution extends Disposable {
	static readonly ID = 'workbench.contrib.customizationsTelemetry';
}
