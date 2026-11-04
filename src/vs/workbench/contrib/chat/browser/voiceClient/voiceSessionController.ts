/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IObservable, constObservable } from '../../../../../base/common/observable.js';
import { localize } from '../../../../../nls.js';
import { URI } from '../../../../../base/common/uri.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { ChatEntitlement, IChatEntitlementService, isProUser } from '../../../../services/chat/common/chatEntitlementService.js';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export function isVoiceEntitled(chatEntitlementService: IChatEntitlementService): boolean {
	return isProUser(chatEntitlementService.entitlement)
		&& (chatEntitlementService.isInternal
			|| (chatEntitlementService.entitlement !== ChatEntitlement.Business
				&& chatEntitlementService.entitlement !== ChatEntitlement.Enterprise));
}

export interface IPendingToolConfirmation {
	readonly type: 'approval' | 'input';
	readonly sessionLabel: string;
	readonly sessionResource: URI;
	readonly description: string;
	approve(): void;
	deny(): void;
}

export interface ITranscriptTurn {
	readonly speaker: 'user' | 'assistant';
	readonly text: string;
	/** Stable-recognition prefix of `text`. User turns only; empty otherwise. */
	readonly committed: string;
	/** True while the user is still speaking (live recognition). */
	readonly isPartial: boolean;
}

/** Compatibility API. The implementation in this fork keeps voice operations inactive. */
export interface IVoiceSessionController {
	readonly _serviceBrand: undefined;

	readonly voiceState: IObservable<VoiceState>;
	readonly statusText: IObservable<string>;
	/** Rolling buffer of the last 2 transcript turns (oldest first). */
	readonly transcriptTurns: IObservable<readonly ITranscriptTurn[]>;
	readonly isConnected: IObservable<boolean>;
	readonly isConnecting: IObservable<boolean>;
	readonly isReconnecting: IObservable<boolean>;
	/** Whether the current connection uses OpenAI GPT Live rather than hosted voice. */
	readonly isUsingGptLive: boolean;
	/** Whether the user has muted the microphone while keeping the session connected. */
	readonly isMuted: IObservable<boolean>;
	readonly pendingToolConfirmations: IObservable<readonly IPendingToolConfirmation[]>;
	/** The session resource that transcriptions will be sent to. undefined = active session. */
	readonly targetSession: IObservable<URI | undefined>;
	/** Whether Voice Mode is explicitly owned by a new-session draft. */
	readonly hasDraftTarget: IObservable<boolean>;
	/** Session that produced the response most recently spoken to the user. */
	getLastSpokenResponseSession(): URI | undefined;

	connect(window: Window & typeof globalThis): Promise<void>;
	/** Update the OS window whose focus controls capture and hands-free listening. */
	setActiveWindow(window: Window & typeof globalThis): void;
	disconnect(source?: 'explicit' | 'internal'): void;

	pttDown(source?: 'explicit' | 'auto' | 'connect', forceNewTurn?: boolean): void;
	pttUp(source?: 'explicit' | 'internal', forceFinish?: boolean): void;

	/**
	 * Stop the current recording / auto-listen loop without disconnecting.
	 * Any in-flight push-to-talk press is finished through the normal
	 * `ptt_end` path (the backend finalizes the turn) and the auto-listen
	 * re-arm loop is suppressed until the user talks again. The WebSocket
	 * stays connected so the user can resume via the Voice Mode button
	 * without a new handshake. Use `disconnect()` to fully end the session.
	 */
	stopListening(source?: 'explicit' | 'internal'): void;

	/**
	 * Mute or unmute the microphone without ending the session. While muted,
	 * captured audio is not forwarded to the backend so background noise or
	 * private speech never reaches transcription, but the WebSocket stays
	 * connected so the user can unmute and resume instantly.
	 */
	setMuted(muted: boolean): void;

	/**
	 * Hold hands-free auto-listen off until released.
	 *
	 * Unlike {@link stopListening}, this is safe to call *before* the session is
	 * connected: it survives the connect handshake, so a caller that needs the
	 * microphone to stay shut while the user reads or decides something can take
	 * the hold at `connect()` time rather than racing `session_init`. Releasing
	 * enters listening immediately if hands-free would have done so.
	 */
	setAutoListenHeld(held: boolean): void;

	/**
	 * Stop the current recording WITHOUT finalizing the turn: any in-flight
	 * push-to-talk press is aborted (no `ptt_end` is sent), so the backend
	 * never finalizes the buffered speech into a `send_to_chat`. Use this on
	 * focus changes so speech captured for one session can't be misrouted to a
	 * newly focused session. Like {@link stopListening}, the WebSocket stays
	 * connected and the auto-listen re-arm loop is suppressed until the user
	 * talks again.
	 */
	discardListening(): void;

	/**
	 * Stop listening on a focus change while the user is actively dictating:
	 * finalize the in-flight press (send `ptt_end`) but pin the resulting
	 * submission to `session` — the session the user was dictating into — so
	 * their words are not misrouted to the newly focused session. The WebSocket
	 * stays connected and the auto-listen re-arm loop is suppressed until the
	 * user talks again. Use {@link discardListening} instead when nothing has
	 * been dictated yet.
	 */
	finishListeningAndSubmitTo(session: URI): void;

	/**
	 * Mark a session as having been cancelled by the user from VS Code UI. The
	 * next state-change detected for this session (typically the chat model
	 * transitioning to `idle`) will be suppressed so the backend doesn't
	 * narrate a status update the user already knows about.
	 */
	markUserCancelled(sessionId: string): void;

	/**
	 * Set the target session for transcription. When set, transcriptions are
	 * sent to this session instead of the currently active one.
	 */
	setTargetSession(resource: URI | undefined): void;
	/** Bind Voice Mode to the currently shown new-session draft. */
	setDraftTarget(): void;

	/**
	 * Create a new chat session and set it as the target for transcription.
	 */
	newSessionAsTarget(): void;

	/**
	 * Declares the session shown in the UI for playback deferral and buffered
	 * flushes. It also supplies `is_active` when no voice target is pinned.
	 * `undefined` restores focus-based detection.
	 * `null` explicitly indicates that a draft with no session is shown.
	 */
	setActiveSessionShown(resource: URI | null | undefined): void;
	/** Promote the owned draft after that draft creates its first chat session. */
	promoteDraftTarget(resource: URI): void;

	/**
	 * Deterministically route audio to and narrate a session in response to an
	 * explicit UI action (e.g. clicking a session's pending-voice indicator).
	 * Unlike the shown/focus heuristics, this activates even when the session is
	 * already the active/shown one - so a completed background reply the user
	 * clicks to hear is played rather than silently ignored because no focus or
	 * view-model change event fired.
	 */
	activateSession(resource: URI): void;

	/**
	 * Submit user feedback along with full diagnostic data (transcript history,
	 * client state, environment info). Returns success/failure.
	 */
	submitFeedback(feedbackText: string): Promise<{ ok: boolean; error?: string }>;

	/** DEV ONLY: Simulate a connected session with fake transcript for UI testing. */
	simulateConnection(): void;
}

export const IVoiceSessionController = createDecorator<IVoiceSessionController>('voiceSessionController');

export type VoiceNewSessionPreparationResult = 'prepared' | 'sent' | 'failed';

/**
 * Whether a chat input owns the current Voice Mode session. A session that
 * targets a draft belongs only to the input whose host owns that draft.
 */
export function isVoiceSessionActiveForInput(inputFocused: boolean, targetSession: URI | undefined, hasDraftTarget: boolean, sessionResource: URI | undefined, ownsDraftTarget = false): boolean {
	if (hasDraftTarget) {
		return ownsDraftTarget;
	}
	if (targetSession) {
		return !!sessionResource && isEqual(targetSession, sessionResource);
	}
	return inputFocused;
}

/** Compatibility adapter: voice sessions are unavailable in this fork. */
export class VoiceSessionController extends Disposable implements IVoiceSessionController {
	declare readonly _serviceBrand: undefined;

	readonly voiceState = constObservable<VoiceState>('error');
	readonly statusText = constObservable(localize('voice.sessionsUnavailable', "Voice Mode is unavailable in Myself IDE."));
	readonly transcriptTurns = constObservable<readonly ITranscriptTurn[]>([]);
	readonly isConnected = constObservable(false);
	readonly isConnecting = constObservable(false);
	readonly isReconnecting = constObservable(false);
	readonly isUsingGptLive = false;
	readonly isMuted = constObservable(false);
	readonly pendingToolConfirmations = constObservable<readonly IPendingToolConfirmation[]>([]);
	readonly targetSession = constObservable<URI | undefined>(undefined);
	readonly hasDraftTarget = constObservable(false);

	getLastSpokenResponseSession(): URI | undefined {
		return undefined;
	}

	// Callers observe the permanent unavailable state; no startup work is performed.
	async connect(_window: Window & typeof globalThis): Promise<void> { }
	setActiveWindow(_window: Window & typeof globalThis): void { }
	disconnect(_source?: 'explicit' | 'internal'): void { }
	pttDown(_source?: 'explicit' | 'auto' | 'connect', _forceNewTurn?: boolean): void { }
	pttUp(_source?: 'explicit' | 'internal', _forceFinish?: boolean): void { }
	stopListening(_source?: 'explicit' | 'internal'): void { }
	setMuted(_muted: boolean): void { }
	setAutoListenHeld(_held: boolean): void { }
	discardListening(): void { }
	finishListeningAndSubmitTo(_session: URI): void { }
	markUserCancelled(_sessionId: string): void { }
	setTargetSession(_resource: URI | undefined): void { }
	setDraftTarget(): void { }
	newSessionAsTarget(): void { }
	setActiveSessionShown(_resource: URI | null | undefined): void { }
	promoteDraftTarget(_resource: URI): void { }
	activateSession(_resource: URI): void { }
	simulateConnection(): void { }

	async submitFeedback(_feedbackText: string): Promise<{ ok: boolean; error?: string }> {
		return { ok: false, error: localize('voice.feedbackUnavailable', "Voice feedback is unavailable in Myself IDE.") };
	}
}

registerSingleton(IVoiceSessionController, VoiceSessionController, InstantiationType.Delayed);
