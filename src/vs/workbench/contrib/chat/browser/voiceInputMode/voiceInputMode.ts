/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, IObservable } from '../../../../../base/common/observable.js';
import { localize } from '../../../../../nls.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * The two mutually-exclusive voice input modes exposed in the chat input.
 * - `dictation`: speech-to-text that types the recognized words into the input box.
 * - `voice`: the live, conversational Voice Mode agent (real-time listen + talk-back).
 */
export type VoiceInputMode = 'dictation' | 'voice';

/**
 * Simulated voice-cell visual states for development/preview, so the UI can be
 * inspected without a live backend connection. `undefined` = use real state.
 */
export type SimulatedVoiceState = 'off' | 'connecting' | 'idle' | 'listening' | 'speaking' | 'dictating';

/**
 * The four push-to-talk interaction designs being compared. Each drives its own
 * prototype walkthrough (state sequence + layout + hint) so they can be evaluated
 * side by side without a live backend.
 * - `handsFree`:   auto-listen + auto-send; hold a key only to barge in / interrupt.
 * - `keyboardHold`: walkie-talkie — hold a keybinding to talk; button only connects.
 * - `buttonHold`:  hold the voice button to talk; a quick tap disconnects.
 * - `clickToggle`: tap the button to start listening, tap again to stop.
 */
export type VoiceWalkthroughVersion = 'handsFree' | 'keyboardHold' | 'buttonHold' | 'clickToggle';

/**
 * Which voice input mode is currently selected in the segmented toggle. This is the
 * single source of truth for *which* segment is highlighted — distinct from whether
 * that mode is currently active (listening / connected / speaking).
 */
export const CHAT_VOICE_INPUT_MODE = new RawContextKey<VoiceInputMode>('chatVoiceInputMode', 'voice', { type: 'string', description: localize('chatVoiceInputMode', "The currently selected voice input mode in the chat input (dictation or voice).") });

export const IVoiceInputModeService = createDecorator<IVoiceInputModeService>('voiceInputModeService');

export interface IVoiceInputModeService {
	readonly _serviceBrand: undefined;

	/** The currently selected mode (persisted). */
	readonly selectedMode: IObservable<VoiceInputMode>;

	/** Whether live Voice Mode is enabled and its chat-input control is visible. */
	readonly voiceAvailable: IObservable<boolean>;

	/** Whether dictation is configured and its chat-input control is visible. */
	readonly dictationAvailable: IObservable<boolean>;

	/** Whether Voice Mode runs hands-free (auto-listen) vs manual push-to-talk. */
	readonly handsFree: IObservable<boolean>;

	/** Dev/preview override for the voice-cell visual state (undefined = real state). */
	readonly simulatedVoiceState: IObservable<SimulatedVoiceState | undefined>;

	/** Dev/preview override for hands-free layout (undefined = real config). */
	readonly simulatedHandsFree: IObservable<boolean | undefined>;

	/** Dev/preview: which push-to-talk version the walkthrough is demoing (undefined = none). */
	readonly simulatedVersion: IObservable<VoiceWalkthroughVersion | undefined>;

	/** Dev/preview: whether the voice cell is being "hovered" (walkthrough only). */
	readonly simulatedHover: IObservable<boolean>;

	/** Persist a new selected mode and update the context key. */
	setSelectedMode(mode: VoiceInputMode): void;

	/** Set (or clear) the dev/preview simulated voice-cell state. */
	setSimulatedVoiceState(state: SimulatedVoiceState | undefined): void;

	/** Auto-play (looping) through a push-to-talk version's states, incl. glow. */
	startVoiceStateWalkthrough(version: VoiceWalkthroughVersion): void;

	/** Advance the simulated state to the next one in the walkthrough sequence. */
	stepVoiceStateWalkthrough(): void;

	/** Stop any running walkthrough and clear the simulated state. */
	clearSimulation(): void;
}

/** Inactive compatibility service: no storage, configuration, context subscriptions or simulations. */
export class VoiceInputModeService extends Disposable implements IVoiceInputModeService {
	declare readonly _serviceBrand: undefined;

	readonly selectedMode = constObservable<VoiceInputMode>('voice');
	readonly voiceAvailable = constObservable(false);
	readonly dictationAvailable = constObservable(false);
	readonly handsFree = constObservable(false);
	readonly simulatedVoiceState = constObservable<SimulatedVoiceState | undefined>(undefined);
	readonly simulatedHandsFree = constObservable<boolean | undefined>(undefined);
	readonly simulatedVersion = constObservable<VoiceWalkthroughVersion | undefined>(undefined);
	readonly simulatedHover = constObservable(false);

	setSelectedMode(_mode: VoiceInputMode): void { }
	setSimulatedVoiceState(_state: SimulatedVoiceState | undefined): void { }
	startVoiceStateWalkthrough(_version: VoiceWalkthroughVersion): void { }
	stepVoiceStateWalkthrough(): void { }
	clearSimulation(): void { }
}

registerSingleton(IVoiceInputModeService, VoiceInputModeService, InstantiationType.Delayed);
