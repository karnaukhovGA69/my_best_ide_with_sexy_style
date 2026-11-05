/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IVoiceCodeTranscriptionClient = createDecorator<IVoiceCodeTranscriptionClient>('voiceCodeTranscriptionClient');

export interface IVoiceCodeTranscription {
	readonly turnId: string;
	readonly text: string;
	readonly status: 'partial' | 'final';
	readonly revision: number;
	readonly committed: string;
}

export interface IVoiceCodeTranscriptionError {
	readonly detail: string;
	readonly code?: string;
	readonly turnId?: string;
	readonly terminal?: boolean;
}

export interface IVoiceCodeTranscriptionClient {
	readonly _serviceBrand: undefined;
	readonly onTranscription: Event<IVoiceCodeTranscription>;
	readonly onError: Event<IVoiceCodeTranscriptionError>;
	readonly onDidClose: Event<number>;
	readonly isConnected: boolean;

	connect(window: Window & typeof globalThis, authToken: string): Promise<void>;
	startSession(): Promise<void>;
	sendPttStart(turnId: string): void;
	sendPttAudioChunk(turnId: string, audio: string): void;
	sendPttEnd(turnId: string): void;
	disconnect(): void;
}

/** Keeps shared Chat consumers compatible without a transcription transport. */
export class VoiceCodeTranscriptionClient extends Disposable implements IVoiceCodeTranscriptionClient {
	declare readonly _serviceBrand: undefined;

	readonly onTranscription = Event.None;
	readonly onError = Event.None;
	readonly onDidClose = Event.None;
	readonly isConnected = false;

	async connect(_window: Window & typeof globalThis, _authToken: string): Promise<void> {
		throw transcriptionUnavailable();
	}

	async startSession(): Promise<void> {
		throw transcriptionUnavailable();
	}

	sendPttStart(_turnId: string): void {
		throw transcriptionUnavailable();
	}

	sendPttAudioChunk(_turnId: string, _audio: string): void {
		throw transcriptionUnavailable();
	}

	sendPttEnd(_turnId: string): void {
		throw transcriptionUnavailable();
	}

	disconnect(): void {
		// No connection, timers or session state to release.
	}
}

function transcriptionUnavailable(): Error {
	return new Error(localize('voiceTranscriptionUnavailable', "AI voice transcription is unavailable in Myself IDE."));
}
