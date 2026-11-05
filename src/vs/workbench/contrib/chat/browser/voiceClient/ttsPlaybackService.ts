/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { localize } from '../../../../../nls.js';

export const ITtsPlaybackService = createDecorator<ITtsPlaybackService>('ttsPlaybackService');

export interface ITtsPlaybackService {
	readonly _serviceBrand: undefined;

	/** Append a base64-encoded audio chunk for streaming playback. */
	playAudioChunk(audio: string, isFinal: boolean, window: Window & typeof globalThis): void;

	/** Stop any current playback immediately. */
	stopPlayback(): void;

	readonly isPlaying: boolean;

	readonly onPlaybackStarted: Event<void>;
	readonly onPlaybackStopped: Event<void>;

	/** Returns the PCM samples from the last completed playback turn, or null. */
	getLastPlayedSamples(): Float32Array | null;

	/** The playback AnalyserNode for visualisation, available during playback. */
	readonly analyserNode: AnalyserNode | undefined;

	/**
	 * Request the playback AudioContext.
	 * Throws while voice playback is unavailable in this fork.
	 */
	ensureContext(window: Window & typeof globalThis): AudioContext;

	/** Close the AudioContext entirely (for full teardown). */
	closeContext(): void;
}

/** Compatibility adapter: voice audio playback is unavailable in this fork. */
export class TtsPlaybackService extends Disposable implements ITtsPlaybackService {
	declare readonly _serviceBrand: undefined;

	readonly onPlaybackStarted: Event<void> = Event.None;
	readonly onPlaybackStopped: Event<void> = Event.None;
	readonly isPlaying = false;
	readonly analyserNode = undefined;

	getLastPlayedSamples(): Float32Array | null {
		return null;
	}

	ensureContext(_window: Window & typeof globalThis): AudioContext {
		throw new Error(localize('voice.playbackUnavailable', "Voice audio playback is unavailable in Myself IDE."));
	}

	playAudioChunk(_audio: string, _isFinal: boolean, _window: Window & typeof globalThis): void { }
	stopPlayback(): void { }
	closeContext(): void { }
}

registerSingleton(ITtsPlaybackService, TtsPlaybackService, InstantiationType.Delayed);
