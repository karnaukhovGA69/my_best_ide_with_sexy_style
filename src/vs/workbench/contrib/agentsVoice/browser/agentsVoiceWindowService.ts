/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAgentsVoiceWindowService } from '../common/agentsVoice.js';

/** Compatibility service: the floating voice window is unavailable in this fork. */
export class AgentsVoiceWindowService extends Disposable implements IAgentsVoiceWindowService {
	declare readonly _serviceBrand: undefined;
	readonly isOpen = false;
	readonly onDidChangeOpen: Event<boolean> = Event.None;

	async openWindow(): Promise<void> { }
	closeWindow(): void { }
	async toggleWindow(): Promise<void> { }
}

registerSingleton(IAgentsVoiceWindowService, AgentsVoiceWindowService, InstantiationType.Delayed);
