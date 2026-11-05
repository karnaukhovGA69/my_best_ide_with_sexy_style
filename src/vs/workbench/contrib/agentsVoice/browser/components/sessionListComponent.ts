/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { URI } from '../../../../../base/common/uri.js';
import type { IPendingToolConfirmation } from '../../../chat/browser/voiceClient/voiceSessionController.js';

export interface SessionRowData {
	readonly resource: URI;
	readonly label: string;
	readonly isActive: boolean;
	readonly needsInput: boolean;
	readonly isIdle: boolean;
	readonly isSpeaking: boolean;
	readonly insertions: number;
	readonly deletions: number;
	readonly toolConfirmation: IPendingToolConfirmation | undefined;
}

export interface SessionGroupData {
	readonly label: string;
	readonly sessions: readonly SessionRowData[];
}
