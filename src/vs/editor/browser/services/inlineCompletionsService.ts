/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const IInlineCompletionsService = createDecorator<IInlineCompletionsService>('IInlineCompletionsService');

/** Compatibility contract for remaining consumers; generative inline suggestions are unavailable in Myself IDE. */
export interface IInlineCompletionsService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeIsSnoozing: Event<boolean>;
	readonly snoozeTimeLeft: number;
	snooze(durationMs?: number): void;
	setSnoozeDuration(durationMs: number): void;
	isSnoozing(): boolean;
	cancelSnooze(): void;
	reportNewCompletion(requestUuid: string): void;
}

/** No timers, completion identifiers, storage, telemetry, or UI are retained by this adapter. */
export class InlineCompletionsService extends Disposable implements IInlineCompletionsService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeIsSnoozing = Event.None;
	readonly snoozeTimeLeft = 0;

	snooze(_durationMs?: number): void { }
	setSnoozeDuration(_durationMs: number): void { }
	isSnoozing(): boolean { return false; }
	cancelSnooze(): void { }
	reportNewCompletion(_requestUuid: string): void { }
}

registerSingleton(IInlineCompletionsService, InlineCompletionsService, InstantiationType.Delayed);
