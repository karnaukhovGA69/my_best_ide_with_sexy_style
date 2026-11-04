/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IObservable, constObservable } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IVoicePlaybackService = createDecorator<IVoicePlaybackService>('voicePlaybackService');

export interface IVoicePlaybackEntry {
	readonly transcript: string;
	readonly timestamp: number;
}

/**
 * Tracks voice playback state for chat sessions: which session is currently
 * speaking, and what the last played message was for each session. Used by
 * the agent sessions view to highlight the speaking row and to drive the
 * "Replay Last Played" action.
 *
 * Playback is reported by the voice agent webview through the workbench
 * commands `_chat.voicePlayback.notifyStart` / `_chat.voicePlayback.notifyEnd`.
 */
export interface IVoicePlaybackService {
	readonly _serviceBrand: undefined;

	/**
	 * The session resource currently being spoken aloud, or `undefined` if
	 * playback is generic (no session id from the backend) or stopped.
	 */
	readonly speakingSession: IObservable<URI | undefined>;

	/**
	 * Increments whenever the per-session last-played map changes. Consumers
	 * can subscribe via `read(reader)` to refresh state without us exposing
	 * the underlying `ResourceMap`.
	 */
	readonly lastPlayedVersion: IObservable<number>;

	/**
	 * Increments whenever the set of sessions with a pending (deferred) voice
	 * response changes. The agent sessions view subscribes to this to show a
	 * pending-response indicator on the affected rows.
	 */
	readonly pendingResponseVersion: IObservable<number>;

	/**
	 * Records the start of a TTS playback. When `sessionResource` is undefined,
	 * the audio is generic and no per-session state is updated.
	 */
	notifyPlaybackStart(sessionResource: URI | undefined, transcript: string | undefined): void;
	notifyPlaybackEnd(sessionResource: URI | undefined): void;

	getLastPlayed(sessionResource: URI): IVoicePlaybackEntry | undefined;
	hasLastPlayed(sessionResource: URI): boolean;

	/**
	 * Marks whether a session has a voice response that arrived while the
	 * session was not focused and is being held until the user focuses it.
	 * Drives the pending-response indicator in the agent sessions view.
	 */
	setPendingResponse(sessionResource: URI, pending: boolean): void;
	hasPendingResponse(sessionResource: URI): boolean;

	/**
	 * Replays the last played message for `sessionResource` by re-synthesizing
	 * the saved transcript through the registered speech provider. Resolves
	 * once playback completes (or immediately when there is nothing to replay
	 * or no speech provider is available).
	 */
	replay(sessionResource: URI): Promise<void>;

	/**
	 * Stops any active playback for the given session (or all playback if
	 * no session is specified).
	 */
	stop(sessionResource?: URI): void;
}

/** Keeps shared Chat/Sessions consumers compatible without retaining or playing speech. */
export class VoicePlaybackService extends Disposable implements IVoicePlaybackService {
	declare readonly _serviceBrand: undefined;

	readonly speakingSession: IObservable<URI | undefined> = constObservable(undefined);
	readonly lastPlayedVersion: IObservable<number> = constObservable(0);
	readonly pendingResponseVersion: IObservable<number> = constObservable(0);

	notifyPlaybackStart(_sessionResource: URI | undefined, _transcript: string | undefined): void {
		// Voice playback does not retain transcripts or session state in this fork.
	}

	notifyPlaybackEnd(_sessionResource: URI | undefined): void { }

	getLastPlayed(_sessionResource: URI): IVoicePlaybackEntry | undefined {
		return undefined;
	}

	hasLastPlayed(_sessionResource: URI): boolean {
		return false;
	}

	setPendingResponse(_sessionResource: URI, _pending: boolean): void { }

	hasPendingResponse(_sessionResource: URI): boolean {
		return false;
	}

	async replay(_sessionResource: URI): Promise<void> {
		// With no retained transcript there is nothing to replay.
	}

	stop(_sessionResource?: URI): void { }
}

registerSingleton(IVoicePlaybackService, VoicePlaybackService, InstantiationType.Delayed);
