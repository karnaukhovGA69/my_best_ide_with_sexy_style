/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import type { IChatMode } from './chatModes.js';

export function reportChatModeChange(_telemetryService: ITelemetryService, _currentMode: IChatMode, _targetMode: IChatMode, _requestCount: number, _provider: string | undefined): void {
	// Mode changes are not inspected or reported for analytics.
}
