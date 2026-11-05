/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from '../../../../../base/common/color.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { GlowThemeKind, IVoiceGlowColors, VoiceRimMood } from './voiceGlow.js';

export type { GlowThemeKind };

export interface IVoiceGlowController extends IDisposable {
	/** Show/keep the connected glow, driving intensity from `level` ([0,1]). */
	render(level: number, reducedMotion: boolean): void;
	/** Fade the glow out (not-owner / disconnected). */
	clear(): void;
	/** Re-apply the current state after a color-theme change. */
	refreshTheme(): void;
}

export interface IVoiceRimLight extends IDisposable {
	/** Advance the rim from the smoothed audio `level` ([0,1]). */
	drive(level: number): void;
	/** Pin to a representative still frame (reduced motion). */
	driveStatic(level: number): void;
	/** Re-mount with a freshly resolved accent / theme. */
	refresh(accent: Color, theme: GlowThemeKind, background?: Color): void;
}

/** Voice rendering is unavailable; do not read theme callbacks or mutate the host. */
export function createVoiceGlowController(_target: HTMLElement, _themeKind?: () => GlowThemeKind, _colors?: () => IVoiceGlowColors): IVoiceGlowController {
	return {
		render: () => { },
		clear: () => { },
		refreshTheme: () => { },
		dispose: () => { },
	};
}

/** Retain the caller contract without creating DOM, animations or cleanup timers. */
export function createVoiceRimLight(_target: HTMLElement, _accent: Color, _theme: GlowThemeKind, _mood: VoiceRimMood = 'cool', _background?: Color): IVoiceRimLight {
	return {
		drive: () => { },
		driveStatic: () => { },
		refresh: () => { },
		dispose: () => { },
	};
}
