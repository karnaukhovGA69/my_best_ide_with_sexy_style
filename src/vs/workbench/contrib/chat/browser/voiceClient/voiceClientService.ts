/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { localize } from '../../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import {
	IVoiceClientService,
	IVoicePriorTimelineEntry,
	IVoicePttStartOptions,
	IVoiceSessionContext,
	IVoiceTranscription,
	IVoiceAudioResponse,
	IVoiceToolCall,
	IVoiceSpeechStarted,
	IVoiceSessionInit,
	IVoiceFeedbackPayload,
	IVoiceTurnConfig,
	IVoiceTurnAutoEnded,
	IVoiceConnectionIssue,
	IVoiceFatalDisconnect,
	IVoiceBargeIn,
	IVoiceNarrationAck,
	IVoiceNarrationSignal,
	IVoiceDispatchResult,
	IVoiceCheckpointNarrationMetadata,
	VoiceConfirmationType,
	VoiceNarrationKind,
} from '../../common/voiceClient/voiceClientService.js';

const ASR_SUPPORTED_LANGUAGE_BASES = new Set([
	'ar', 'cs', 'da', 'de', 'en', 'es', 'fi', 'fr', 'hi', 'hu', 'id', 'it',
	'ja', 'ko', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sv', 'th', 'tr', 'vi', 'zh',
]);
const DEFAULT_LANGUAGE = 'en-US';

function canonicalizeSupportedLanguage(value: string | undefined, supportedBases: ReadonlySet<string>): string | undefined {
	const candidate = value?.trim();
	if (!candidate || typeof Intl.getCanonicalLocales !== 'function') {
		return undefined;
	}

	try {
		const canonical = Intl.getCanonicalLocales(candidate)[0];
		return supportedBases.has(canonical.split('-')[0]) ? canonical : undefined;
	} catch {
		return undefined;
	}
}

export function resolveAutomaticVoiceLanguage(browserLanguage: string | undefined, displayLanguage: string | undefined): string {
	return canonicalizeSupportedLanguage(displayLanguage, ASR_SUPPORTED_LANGUAGE_BASES)
		?? canonicalizeSupportedLanguage(browserLanguage, ASR_SUPPORTED_LANGUAGE_BASES)
		?? DEFAULT_LANGUAGE;
}

/** Compatibility adapter: voice transport is unavailable in this fork. */
export class VoiceClientService extends Disposable implements IVoiceClientService {
	declare readonly _serviceBrand: undefined;

	readonly onTranscription: Event<IVoiceTranscription> = Event.None;

	readonly onAudioResponse: Event<IVoiceAudioResponse> = Event.None;

	readonly onBargeIn: Event<IVoiceBargeIn> = Event.None;

	readonly onNarrationAck: Event<IVoiceNarrationAck> = Event.None;

	readonly onNarrationUnblocked: Event<IVoiceNarrationSignal> = Event.None;

	readonly onNarrationInterrupted: Event<IVoiceNarrationSignal> = Event.None;

	readonly onToolCall: Event<IVoiceToolCall> = Event.None;

	readonly onSpeechStarted: Event<IVoiceSpeechStarted> = Event.None;

	readonly onSessionInit: Event<IVoiceSessionInit> = Event.None;

	private readonly _onError = this._register(new Emitter<string>());
	readonly onError: Event<string> = this._onError.event;

	readonly onDidChangeConnectionState: Event<boolean> = Event.None;

	readonly onDidChangeRemoteAudioState: Event<boolean> = Event.None;

	private readonly _onFatalDisconnect = this._register(new Emitter<IVoiceFatalDisconnect>());
	readonly onFatalDisconnect: Event<IVoiceFatalDisconnect> = this._onFatalDisconnect.event;

	readonly onConnectionIssue: Event<IVoiceConnectionIssue> = Event.None;

	readonly onTurnAutoEnded: Event<IVoiceTurnAutoEnded> = Event.None;

	readonly isConnected = false;
	readonly isResuming = false;
	readonly isSessionAwarenessEnabled = false;
	readonly willReconnect = false;
	readonly currentSessionId = undefined;

	async hasGptLiveByok(): Promise<boolean> {
		return false;
	}

	async connect(_window: Window & typeof globalThis, _authToken?: string): Promise<void> {
		const reason = localize('voice.transportUnavailable', "Voice transport is unavailable in Myself IDE.");
		this._onError.fire(reason);
		// Existing callers handle startup failures through this terminal event.
		this._onFatalDisconnect.fire({ code: 0, reason, kind: 'fatal' });
	}

	disconnect(): void { }

	sendPttStart(_turnId: string, _options: IVoicePttStartOptions): void { }
	sendPttAudioChunk(_audio: string): void { }
	sendPttEnd(): void { }
	sendPttDiagnostic(_turnId: string, _metrics: Record<string, unknown>): void { }
	sendSessionContext(_context: IVoiceSessionContext): void { }
	flushSessionContext(): void { }
	invalidateSessionCache(_sessionId: string): void { }
	sendToolResult(_callId: string, _result: string | IVoiceDispatchResult, _toolName?: string, _toolArgs?: Readonly<Record<string, unknown>>): void { }
	sendNarrationPlaybackComplete(_codingSessionId: string, _narrationId: string, _playbackId: string): void { }

	requestNarration(_codingSessionId: string, _kind: VoiceNarrationKind, _text: string, _narrationId?: string, _checkpoint?: IVoiceCheckpointNarrationMetadata, _confirmationType?: VoiceConfirmationType, _pending?: { pendingId: string }): string | undefined {
		return undefined;
	}

	sendSessionStateChange(_sessionId: string, _newState: string, _label: string, _detail?: string, _lastResponseSummary?: string): void { }
	stopSpeaking(): void { }
	prepareForInputTargetChange(): void { }
	sendStartSession(_context: IVoiceSessionContext, _machineId: string, _priorTimeline?: readonly IVoicePriorTimelineEntry[], _turnConfigOverride?: IVoiceTurnConfig, _voiceInstructions?: string): void { }
	sendResumeSession(_context: IVoiceSessionContext, _machineId: string, _voiceInstructions?: string): void { }

	async submitFeedback(_payload: IVoiceFeedbackPayload): Promise<{ ok: boolean; error?: string }> {
		return { ok: false, error: localize('voice.feedbackUnavailable', "Voice feedback is unavailable in Myself IDE.") };
	}
}

registerSingleton(IVoiceClientService, VoiceClientService, InstantiationType.Delayed);
