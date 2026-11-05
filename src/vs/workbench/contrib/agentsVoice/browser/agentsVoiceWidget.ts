/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import type { SessionRowData, SessionGroupData } from './components/sessionListComponent.js';
import type { VoiceState, IPendingToolConfirmation, ITranscriptTurn } from '../../chat/browser/voiceClient/voiceSessionController.js';
import type { IVoiceGlowColors } from '../../chat/browser/voiceClient/voiceGlow.js';
import type { GlowThemeKind } from '../../chat/browser/voiceClient/voiceGlowController.js';

export interface VoiceWidgetCallbacks {
	readonly copilotIconSrc: string;
	readonly hideDisconnect: boolean;
	connect(): void;
	disconnect(): void;
	pttDown(): void;
	pttUp(): void;
	/** Toggle whether the microphone is muted while keeping the session connected. */
	toggleMute(): void;
	closeWindow(): void;
	stopPlayback(): void;
	openSession(resource: URI): void;
	stopSession(resource: URI): void;
	cancelSession(resource: URI): void;
	/** Select a session as the transcription target. */
	selectTargetSession(resource: URI | undefined): void;
	/** Create a new session and set it as transcription target. */
	newSessionAsTarget(): void;
	getAnalyserNode(): AnalyserNode | null;
	onResize(): void;
	openPttKeySettings(): void;
	/**
	 * Show the Voice Mode context menu (Configure, Select Microphone, Disable
	 * Voice Mode) anchored at the triggering event. Wired to a right-click /
	 * context-menu gesture on the voice mode mic icon.
	 */
	showVoiceContextMenu(e: MouseEvent): void;
	/** Optional — when provided, header renders a "popout" button. */
	openPopout?(): void;
	/** Submit user feedback. Returns success/failure. */
	submitFeedback(feedbackText: string): Promise<{ ok: boolean; error?: string }>;
	/** Called when the user dismisses the onboarding card. */
	onOnboardingCompleted?(): void;
	/**
	 * Optional — when provided, the expand chevron opens this picker instead of
	 * the inline session list. Used by the floating window to show the agent
	 * sessions quickpick with a "set as voice target" action.
	 */
	showSessionsPicker?(): void;
	/** Active theme kind, for the ambient voice glow. */
	getGlowTheme(): GlowThemeKind;
	/** Theme-derived per-state accents for the ambient voice glow. */
	getGlowColors(): IVoiceGlowColors;
	/** Whether the user has asked for reduced motion. */
	isMotionReduced(): boolean;
	/** Fires when the color theme changes, so the glow can re-derive its accents. */
	readonly onDidChangeGlowTheme: Event<void>;
}

/**
 * Host-configuration for the widget. Defaults match the floating aux-window
 * (the original consumer); the chatViewPane voice bar overrides everything.
 */
export interface VoiceWidgetOptions {
	/** Fixed pixel width (legacy aux-window behavior) or `'auto'` to flow. */
	readonly width?: number | 'auto';
	/** Whether the header is a drag handle (aux window only). */
	readonly draggable?: boolean;
	/** Show the close X in the header. */
	readonly showClose?: boolean;
	/** Show the expand/collapse chevron + session list. */
	readonly showExpandChevron?: boolean;
	/** Show the centered "Tap to start / Listening / Speaking" status label. */
	readonly showStatusText?: boolean;
	/**
	 * Show the working/needs-input/done counter rows and the "No active sessions"
	 * placeholder. The speaking-session pill and tool confirmations remain
	 * visible regardless, since they are important interactive context.
	 */
	readonly showStatusCounters?: boolean;
	/** Show the copilot icon at the start of the header. */
	readonly showCopilotIcon?: boolean;
	/** Center the Connect button horizontally instead of pushing it to the right. */
	readonly centerConnectButton?: boolean;
	/** Optional title rendered above the header row (e.g. "VOICE CHAT"). */
	readonly title?: string;
	/** Optional subtitle rendered next to the title. */
	readonly subtitle?: string;
	/** Set tabIndex=0 on the widget root and wire Space-key PTT. */
	readonly focusable?: boolean;
	/** Whether to show the onboarding card (first-time experience). */
	readonly showOnboarding?: boolean;
	/**
	 * When true, the onboarding card re-appears every time the widget enters
	 * a fully-disconnected state (i.e. not connected, not connecting, and not
	 * auto-reconnecting). When false (default), onboarding follows the legacy
	 * first-time-only behavior gated by ``showOnboarding`` + manual dismiss.
	 */
	readonly reshowOnboardingOnDisconnect?: boolean;
	/**
	 * Initial expanded state of the widget — when true the session list and
	 * expanded session details are shown by default. Defaults to false
	 * (collapsed) to match the legacy floating aux-window behavior.
	 */
	readonly defaultExpanded?: boolean;
	/**
	 * When true, renders the widget in a chat-input-box style layout:
	 * a rounded bordered container for transcript/placeholder text with a
	 * toolbar row below for action icons. Matches the chat panel input box
	 * appearance.
	 */
	readonly inputBoxLayout?: boolean;
}

/** Compatibility widget: voice UI is unavailable; no DOM or callbacks are created. */
export class AgentsVoiceWidget extends Disposable {
	constructor(_container: HTMLElement, _callbacks: VoiceWidgetCallbacks, _options: VoiceWidgetOptions = {}) {
		super();
	}

	setConnected(_connected: boolean): void { }
	setConnecting(_connecting: boolean): void { }
	setReconnecting(_reconnecting: boolean): void { }
	setMuted(_muted: boolean): void { }
	setVoiceState(_state: VoiceState): void { }
	setStatusCounts(_working: number, _needsInput: number, _done: number): void { }
	setPendingToolConfirmations(_confirmations: readonly IPendingToolConfirmation[]): void { }
	setSpeakingSession(_session: URI | undefined, _label: string | undefined): void { }
	setSessions(_sessions: readonly SessionRowData[]): void { }
	setSelectedTargetSession(_resource: URI | undefined): void { }
	setSessionGroups(_groups: readonly SessionGroupData[] | undefined): void { }
	setPttKeyLabel(_label: string | undefined): void { }
	setTranscriptTurns(_turns: readonly ITranscriptTurn[]): void { }
	setStatusText(_text: string): void { }
	setPopoutAvailable(_available: boolean): void { }
	dismissOnboarding(): void { }
}
