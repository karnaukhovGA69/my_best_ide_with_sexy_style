/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IInlineChatSession, IInlineChatSessionService } from './inlineChatSessionService.js';
import { IInlineChatSessionResolution, IInlineChatSessionResolver } from './inlineChatSessionResolver.js';

export class UnavailableInlineChatSessionService implements IInlineChatSessionService {
	declare readonly _serviceBrand: undefined;
	readonly onWillStartSession = Event.None;
	readonly onDidChangeSessions = Event.None;

	async createSession(): Promise<IInlineChatSession> {
		throw new Error('Inline chat is not available in Myself IDE.');
	}

	getSessionByTextModel(): undefined { return undefined; }
	getSessionBySessionUri(): undefined { return undefined; }
}

export class UnavailableInlineChatSessionResolver implements IInlineChatSessionResolver {
	declare readonly _serviceBrand: undefined;

	async resolve(): Promise<IInlineChatSessionResolution | undefined> {
		return undefined;
	}
}
