/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryService, TelemetryLevel } from '../../telemetry/common/telemetry.js';

/** Compatibility facade for retained editor consumers. This distribution does not collect or forward edit telemetry. */
export class DataChannelForwardingTelemetryService implements ITelemetryService {
	declare readonly _serviceBrand: undefined;
	readonly telemetryLevel = TelemetryLevel.NONE;
	readonly sessionId = '';
	readonly machineId = '';
	readonly sqmId = '';
	readonly devDeviceId = '';
	readonly firstSessionDate = '';
	readonly msftInternal = undefined;
	readonly sendErrorTelemetry = false;

	publicLog: ITelemetryService['publicLog'] = () => { };
	publicLog2: ITelemetryService['publicLog2'] = () => { };
	publicLogError: ITelemetryService['publicLogError'] = () => { };
	publicLogError2: ITelemetryService['publicLogError2'] = () => { };
	setExperimentProperty: ITelemetryService['setExperimentProperty'] = () => { };
	setCommonProperty: ITelemetryService['setCommonProperty'] = () => { };
}

const shouldForwardToChannel = Symbol('shouldForwardToChannel');
export function forwardToChannelIf(value: boolean): Record<string, unknown> {
	return {
		// This will not be sent via telemetry, it is just a marker
		[shouldForwardToChannel]: value
	};
}

export function isCopilotLikeExtension(extensionId: string | undefined): boolean {
	if (!extensionId) {
		return false;
	}
	const extIdLowerCase = extensionId.toLowerCase();
	return extIdLowerCase === 'github.copilot' || extIdLowerCase === 'github.copilot-chat';
}
