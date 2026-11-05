/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from '../../../../../base/common/color.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { IObservable } from '../../../../../base/common/observable.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { IColorTheme, IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { chatDictationActiveMicGlow } from '../../common/widget/chatColors.js';
import { ChatSpeechToTextState, IChatSpeechToTextService } from './chatSpeechToTextService.js';

export type DictationMicGlowPhase = 'off' | 'live' | 'settling';

/** `off` while preparing too, so the glow doesn't compete with the download ring. */
export function getDictationMicGlowPhase(state: ChatSpeechToTextState, isPreparingModel: boolean): DictationMicGlowPhase {
	if (isPreparingModel || state === ChatSpeechToTextState.Idle) {
		return 'off';
	}
	return state === ChatSpeechToTextState.Recording ? 'live' : 'settling';
}

/**
 * Asymmetric, so the glow swells into speech but drifts back out of it. Tracking
 * the level symmetrically reads as a level meter rather than as ambient light.
 */
export function easeDictationMicLevel(current: number, target: number): number {
	return current + (target - current) * (target > current ? 0.1 : 0.035);
}

/** Lifts quiet speech and clamps loud speech, so the glow breathes rather than flashes. */
export function shapeDictationMicLevel(level: number): number {
	return Math.min(1, Math.pow(Math.min(1, Math.max(0, level)), 0.7) * 1.15);
}

export function resolveDictationMicAccent(theme: IColorTheme): Color | undefined {
	return theme.getColor(chatDictationActiveMicGlow);
}

/** Dictation indicators are unavailable; do not observe services or modify the host. */
export function setupDictationMicGlow(
	_target: HTMLElement,
	_service: IChatSpeechToTextService,
	_accessibilityService: IAccessibilityService,
	_isActive?: IObservable<boolean>,
	_themeService?: IThemeService,
): IDisposable {
	return Disposable.None;
}
