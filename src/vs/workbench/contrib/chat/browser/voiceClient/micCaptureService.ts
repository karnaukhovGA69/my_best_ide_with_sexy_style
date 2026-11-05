/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { localize } from '../../../../../nls.js';
import { mainWindow } from '../../../../../base/browser/window.js';

export const IMicCaptureService = createDecorator<IMicCaptureService>('micCaptureService');

export function getMediaCaptureWindow(targetWindow: Window & typeof globalThis): Window & typeof globalThis {
	return targetWindow === mainWindow ? targetWindow : mainWindow;
}

/** Number of samples buffered per 32 ms voice capture chunk at 16 kHz, matching one Silero VAD frame. */
export const MIC_CAPTURE_CHUNK_SIZE = 512;

export function isMicrophonePermissionDeniedError(error: unknown): boolean {
	return (error instanceof DOMException || error instanceof Error) && error.name === 'NotAllowedError';
}

/**
 * Per-PTT-press diagnostic emitted after `pttUp` once the diagnostic
 * window closes. Logged + sent to backend so we can correlate frontend
 * audio bookkeeping with backend ASR results via `turnId`.
 *
 * Drain model: after `pttUp` the service keeps streaming audio chunks
 * for a fixed "drain window" (~500ms by default). The drain ends as
 * soon as it has shipped enough samples to cover the window (or a
 * fallback timer trips if `onaudioprocess` stops firing). Only AFTER
 * the drain has closed does `_onPttEnd` fire. The diagnostic window is
 * intentionally LONGER than the drain window so any audio still
 * produced after drain end (within the diagnostic window) is counted
 * as `postReleaseCallbacks` -- a direct signal that the drain window
 * is too short for this device/load and the fix needs to extend it.
 *
 * Field interpretation:
 *  - `drainChunks` / `drainSamples` => audio captured during the drain
 *    window and shipped to the backend. Non-zero in normal operation.
 *  - `postReleaseCallbacks > 0` => the WebAudio pipeline produced more
 *    audio AFTER the drain window closed but before the diagnostic
 *    window. This audio was DROPPED; if it happens often the drain
 *    window needs to grow.
 *  - `drainSkippedBy*` > 0 => the drain was muted or AEC-suppressed.
 *    Tail audio for that press was lost; investigate the mute / AEC
 *    suppression path rather than the drain window.
 *  - `pttUpWithoutCapture` => pttUp arrived while mic was not capturing.
 *  - `releasedDuringAcquire` => user released while mic was still being
 *    acquired; no audio was ever recorded for this press.
 */
export interface IPttDiagnostic {
	readonly turnId: string;
	readonly msHeld: number;
	readonly chunksSent: number;
	readonly samplesSent: number;
	readonly drainFired: boolean;
	readonly drainChunks: number;
	readonly drainSamples: number;
	readonly drainWindowMs: number;
	readonly drainSkippedByMute: number;
	readonly drainSkippedBySuppression: number;
	readonly postReleaseCallbacks: number;
	readonly postReleaseSamples: number;
	readonly postReleaseSkippedByMute: number;
	readonly postReleaseSkippedBySuppression: number;
	readonly postReleaseWindowMs: number;
	readonly releasedDuringAcquire: boolean;
	readonly pttUpWithoutCapture: boolean;
}

/** Compatibility API: this fork refuses capture and leaves release/control operations inactive. */
export interface IMicCaptureService {
	readonly _serviceBrand: undefined;

	/**
	 * Store a window reference for later lazy mic acquisition without actually
	 * acquiring the microphone. The mic is acquired on `pttDown()` and released
	 * on `pttUp()`.
	 */
	prepare(window: Window & typeof globalThis): void;

	/** Start capturing audio from the microphone. */
	startCapture(window: Window & typeof globalThis): Promise<void>;

	/** Stop capturing and release mic resources. */
	stopCapture(): void;

	readonly isCapturing: boolean;

	/**
	 * Fired when a PTT segment begins (mic ready). The boolean payload is the
	 * `passive` flag captured at the corresponding `pttDown` call (see there).
	 */
	readonly onPttStart: Event<boolean>;

	/** Fired during PTT hold with base64-encoded raw PCM16 chunks. */
	readonly onPttAudioChunk: Event<string>;

	/** Fired when a PTT segment ends. All chunks have been sent before this fires. */
	readonly onPttEnd: Event<void>;

	/**
	 * Fired after the diagnostic window closes (~1s after `pttUp`) with
	 * per-press telemetry. Always fires AFTER `onPttEnd` for normal
	 * presses. Used for tail-loss diagnosis; safe to ignore for normal
	 * operation.
	 */
	readonly onPttDiagnostic: Event<IPttDiagnostic>;

	/** The AnalyserNode for visualisation, available while capturing. */
	readonly analyserNode: AnalyserNode | undefined;

	/** The captured microphone stream, available after {@link startCapture}. */
	readonly mediaStream: MediaStream | undefined;

	// --- PTT ---
	/**
	 * Begin a PTT segment. Lazily acquires the microphone if not already
	 * capturing. Returns a promise that resolves once the mic is ready to
	 * record (or rejects if acquisition fails).
	 *
	 * `turnId` is an opaque per-press identifier propagated into the
	 * eventual `onPttDiagnostic` payload for correlation with backend logs.
	 * Pass empty string when no correlation is needed.
	 *
	 * `passive` marks this press as a hands-free barge-in listen (mic opened
	 * during assistant playback, not a real user press). It is captured
	 * immutably at call time and carried on the `onPttStart` emission. This
	 * stays correct even if the caller's own state changes during the async
	 * mic acquire.
	 */
	pttDown(turnId: string, passive?: boolean): Promise<void>;

	/**
	 * End a PTT segment. Sends any remaining audio chunks, then fires pttEnd.
	 */
	pttUp(): void;

	/**
	 * Abort the current PTT segment WITHOUT firing ``onPttEnd`` and WITHOUT
	 * tearing down the warm mic. Used when the backend ends the turn itself
	 * (server VAD silence / stop phrase): streaming stops immediately for this
	 * press so no further audio is shipped, but no client ``ptt_end`` is
	 * emitted for the turn. Safe to call when no press is active.
	 */
	abortPtt(): void;

	// --- Mute / AEC suppression ---
	isMuted: boolean;

	/** Suppress mic output until the given timestamp (AEC gating). */
	suppressUntil(timestamp: number): void;
}

/** Compatibility adapter: voice microphone capture is unavailable in this fork. */
export class MicCaptureService extends Disposable implements IMicCaptureService {
	declare readonly _serviceBrand: undefined;

	readonly onPttStart: Event<boolean> = Event.None;
	readonly onPttAudioChunk: Event<string> = Event.None;
	readonly onPttEnd: Event<void> = Event.None;
	readonly onPttDiagnostic: Event<IPttDiagnostic> = Event.None;
	readonly isCapturing = false;
	readonly analyserNode = undefined;
	readonly mediaStream = undefined;

	get isMuted(): boolean { return false; }
	set isMuted(_value: boolean) { }

	prepare(_window: Window & typeof globalThis): void { }

	async startCapture(_window: Window & typeof globalThis): Promise<void> {
		throw new Error(localize('voice.captureUnavailable', "Voice microphone capture is unavailable in Myself IDE."));
	}

	async pttDown(_turnId: string, _passive?: boolean): Promise<void> {
		throw new Error(localize('voice.captureUnavailable', "Voice microphone capture is unavailable in Myself IDE."));
	}

	pttUp(): void { }
	abortPtt(): void { }
	stopCapture(): void { }
	suppressUntil(_timestamp: number): void { }
}

registerSingleton(IMicCaptureService, MicCaptureService, InstantiationType.Delayed);
