/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { IChatUserInteractionTiming } from '../../../../platform/otel/common/chatUserInteraction.js';

export const IChatUserInteractionOTelService = createDecorator<IChatUserInteractionOTelService>('chatUserInteractionOTelService');

export interface IChatUserInteractionOTelService {
	readonly _serviceBrand: undefined;
	begin(): Pick<IChatUserInteractionTiming, 'rendererId' | 'interactionOrdinal'>;
	report(data: IChatUserInteractionTiming, resource: URI | undefined, sessionType: string | undefined): void;
	flush(): Promise<{ schemaVersion: 1; started: number; completed: number; failed: number }>;
}

export class ChatUserInteractionOTelService implements IChatUserInteractionOTelService {
	declare readonly _serviceBrand: undefined;

	begin(): Pick<IChatUserInteractionTiming, 'rendererId' | 'interactionOrdinal'> {
		return { rendererId: '', interactionOrdinal: 0 };
	}

	report(_data: IChatUserInteractionTiming, _resource: URI | undefined, _sessionType: string | undefined): void { }

	async flush(): Promise<{ schemaVersion: 1; started: number; completed: number; failed: number }> {
		return { schemaVersion: 1, started: 0, completed: 0, failed: 0 };
	}
}

registerSingleton(IChatUserInteractionOTelService, ChatUserInteractionOTelService, InstantiationType.Delayed);
CommandsRegistry.registerCommand('_chat.flushUserInteractionTelemetry', accessor => accessor.get(IChatUserInteractionOTelService).flush());
