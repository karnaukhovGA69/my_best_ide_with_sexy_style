/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { IObservable, IReader } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IMicCaptureService } from './micCaptureService.js';
import { ITtsPlaybackService } from './ttsPlaybackService.js';
import { IVoiceSessionController } from './voiceSessionController.js';

export interface IVoiceInputDecorationsServices {
	readonly voiceSessionController: IVoiceSessionController;
	readonly ttsPlaybackService: ITtsPlaybackService;
	readonly micCaptureService: IMicCaptureService;
	readonly configurationService: IConfigurationService;
	readonly keybindingService: IKeybindingService;
	readonly themeService: IThemeService;
	readonly accessibilityService: IAccessibilityService;
}

export interface IVoiceInputDecorationsOptions {
	/** Input container for the transcript overlay. */
	readonly inputContainer: HTMLElement;
	/** Container that receives the ambient glow. Defaults to {@link inputContainer}. */
	readonly glowContainer?: HTMLElement;
	/** Whether this surface is active/visible. */
	readonly isActive: IObservable<boolean>;
	/** Current text in the input. Voice placeholders are hidden while it is non-empty. */
	readonly inputValue?: IObservable<string>;
	/** Explicit ownership for surfaces that do not yet have a resource. */
	readonly isOwner?: IObservable<boolean>;
	/** Surface resource, compared with the voice target to avoid misrouting. */
	readonly getCurrentResource?: (reader: IReader) => URI | undefined;
	/**
	 * The single chat input voice mode is bound to. Only the surface whose
	 * {@link getCurrentResource} matches this renders the glow/transcript, so
	 * voice is active in exactly one input at a time even when several sessions
	 * are visible.
	 */
	readonly currentVoiceInputResource?: IObservable<URI | undefined>;
}

/** Voice overlays and audio-reactive decorations are unavailable in this distribution. */
export function setupVoiceInputDecorations(_services: IVoiceInputDecorationsServices, _options: IVoiceInputDecorationsOptions): IDisposable {
	return Disposable.None;
}
