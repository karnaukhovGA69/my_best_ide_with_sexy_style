/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatModel } from './model/chatModel.js';
import { ISpeechToTextEvent } from '../../speech/common/speechService.js';

export const IVoiceChatService = createDecorator<IVoiceChatService>('voiceChatService');

export interface IVoiceChatSessionOptions {
	readonly usesAgents?: boolean;
	readonly model?: IChatModel;
}

export interface IVoiceChatService {

	readonly _serviceBrand: undefined;

	/**
	 * Similar to `ISpeechService.createSpeechToTextSession`, but with
	 * support for agent prefixes and command prefixes. For example,
	 * if the user says "at workspace slash fix this problem", the result
	 * will be "@workspace /fix this problem".
	 */
	createVoiceChatSession(token: CancellationToken, options: IVoiceChatSessionOptions): Promise<IVoiceChatSession>;
}

export interface IVoiceChatTextEvent extends ISpeechToTextEvent {

	/**
	 * This property will be `true` when the text recognized
	 * so far only consists of agent prefixes (`@workspace`)
	 * and/or command prefixes (`@workspace /fix`).
	 */
	readonly waitingForInput?: boolean;
}

export interface IVoiceChatSession {
	readonly onDidChange: Event<IVoiceChatTextEvent>;
}

export const VoiceChatInProgress = new RawContextKey<boolean>('voiceChatInProgress', false, { type: 'boolean', description: localize('voiceChatInProgress', "A speech-to-text session is in progress for chat.") });

/** Retains the shared contract without starting speech recognition or agent parsing. */
export class VoiceChatService extends Disposable implements IVoiceChatService {
	declare readonly _serviceBrand: undefined;

	async createVoiceChatSession(_token: CancellationToken, _options: IVoiceChatSessionOptions): Promise<IVoiceChatSession> {
		throw new Error(localize('voiceChatUnavailable', "Voice chat is unavailable in Myself IDE."));
	}
}
