/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Color, HSLA } from '../../../../../../base/common/color.js';
import * as sinon from 'sinon';
import { mainWindow } from '../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ColorScheme } from '../../../../../../platform/theme/common/theme.js';
import { IColorTheme } from '../../../../../../platform/theme/common/themeService.js';
import { chatDictationActiveMicGlow, chatVoiceGlowBaseColor, chatVoiceListeningGlow, chatVoiceSpeakingGlow } from '../../../common/widget/chatColors.js';
import { resolveDictationMicAccent } from '../../../browser/speechToText/dictationMicGlow.js';
import { DEFAULT_VOICE_GLOW_COLORS, GlowThemeKind, resolveVoiceGlowColors, resolveVoiceRimAccent, shouldRenderVoiceInputGlow } from '../../../browser/voiceClient/voiceGlow.js';
import { createVoiceGlowController, createVoiceRimLight } from '../../../browser/voiceClient/voiceGlowController.js';

suite('VoiceGlow', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('only renders on the active owner while Voice Mode is connected', () => {
		assert.deepStrictEqual([
			shouldRenderVoiceInputGlow(false, true, true),
			shouldRenderVoiceInputGlow(true, true, true),
			shouldRenderVoiceInputGlow(true, false, true),
			shouldRenderVoiceInputGlow(true, true, false),
		], [false, true, false, false]);
	});

	test('listening and speaking share the blue accent', () => {
		const base = Color.fromHex('#58A6FF');
		const colors = resolveVoiceGlowColors({ getColor: id => id === chatVoiceGlowBaseColor ? base : undefined });
		assert.deepStrictEqual(
			{
				listening: colors.listening.toString(),
				speaking: colors.speaking.toString(),
				fallback: DEFAULT_VOICE_GLOW_COLORS.speaking.toString(),
			},
			{
				listening: base.toString(),
				speaking: base.toString(),
				fallback: base.toString(),
			}
		);
	});

	test('the listening theme override applies to speaking instead of the obsolete speaking override', () => {
		const pinned = Color.fromHex('#007ACC');
		const colors = resolveVoiceGlowColors({
			getColor: id => id === chatVoiceGlowBaseColor ? Color.fromHex('#58A6FF')
				: id === chatVoiceListeningGlow ? pinned
					: id === chatVoiceSpeakingGlow ? Color.fromHex('#A371F7') : undefined,
		});
		assert.deepStrictEqual(
			[colors.listening.toString(), colors.speaking.toString()],
			[pinned.toString(), pinned.toString()],
		);
	});

	test('the dictation microphone paints the listening rim color', () => {
		// Two things must hold: the tuning itself (hue nudge, saturation floor,
		// per-theme lightness) and the fact that dictation and Voice Mode arrive
		// at it from their own tokens. Snapshotting the resolved values pins the
		// former — comparing the two paths alone would cancel it out.
		const base = Color.fromHex('#58A6FF');
		// Deliberately under the saturation floor, so the clamp is exercised.
		const washedOut = Color.fromHex('#7A8B99');
		const theme = (type: ColorScheme, accent: Color) => ({
			type,
			getColor: (id: string) => id === chatVoiceGlowBaseColor || id === chatDictationActiveMicGlow ? accent : undefined,
		});
		const resolve = (type: ColorScheme, kind: GlowThemeKind, accent: Color) => {
			const scheme = theme(type, accent);
			const format = (color: Color) => {
				const rim = resolveVoiceRimAccent(color, 'cool', kind);
				return `${rim.hue.toFixed(1)} ${rim.saturation}% ${rim.lightness}%`;
			};
			return {
				mic: format(resolveDictationMicAccent(scheme as IColorTheme)!),
				voiceMode: format(resolveVoiceGlowColors(scheme).listening),
			};
		};

		assert.deepStrictEqual(
			{
				dark: resolve(ColorScheme.DARK, 'dark', base),
				light: resolve(ColorScheme.LIGHT, 'light', base),
				washedOut: resolve(ColorScheme.DARK, 'dark', washedOut),
			},
			{
				dark: { mic: '202.0 96% 56%', voiceMode: '202.0 96% 56%' },
				light: { mic: '202.0 41% 52%', voiceMode: '202.0 41% 52%' },
				washedOut: { mic: '197.0 70% 56%', voiceMode: '197.0 70% 56%' },
			}
		);
	});

	test('the active rim keeps non-text contrast against custom input backgrounds', () => {
		const accent = Color.fromHex('#7A8B99');
		for (const [kind, background] of [
			['light', Color.fromHex('#FAFAFA')],
			['dark', Color.fromHex('#242424')],
		] as const) {
			const rim = resolveVoiceRimAccent(accent, 'cool', kind, background);
			const rimColor = new Color(new HSLA(rim.hue, rim.saturation / 100, rim.lightness / 100, 1));
			assert.ok(background.getContrastRatio(rimColor) >= 3, `${kind} rim contrast was ${background.getContrastRatio(rimColor)}`);
		}
	});

	test('factories never read target, color or theme providers', () => {
		const unreadable = { get: () => { throw new Error('Input must not be read'); } };
		const target = new Proxy({} as HTMLElement, unreadable);
		const color = new Proxy({} as Color, unreadable);
		const controller = disposables.add(createVoiceGlowController(target, () => { throw new Error('Theme must not be requested'); }, () => { throw new Error('Colors must not be requested'); }));
		controller.render(1, false);
		controller.refreshTheme();
		controller.clear();
		const rim = disposables.add(createVoiceRimLight(target, color, 'dark', 'cool', color));
		rim.drive(1);
		rim.driveStatic(0.5);
		rim.refresh(color, 'light', color);
	});

	test('render, clear, theme changes and repeated disposal preserve host without animation', async () => {
		const sandbox = sinon.createSandbox();
		const timers = sandbox.useFakeTimers();
		try {
			const frames = sandbox.spy(mainWindow, 'requestAnimationFrame');
			const animations = sandbox.spy(Element.prototype, 'animate');
			const target = document.createElement('div');
			target.className = 'existing';
			target.style.position = 'static';
			target.innerHTML = '<input aria-label="Existing input">';
			const original = target.outerHTML;
			const accent = Color.fromHex('#58A6FF');
			const controller = disposables.add(createVoiceGlowController(target));
			const rim = disposables.add(createVoiceRimLight(target, accent, 'dark'));
			for (const reducedMotion of [true, false]) {
				controller.render(0.8, reducedMotion);
				controller.refreshTheme();
				rim.drive(0.9);
				rim.driveStatic(0.2);
				rim.refresh(accent, 'light');
				controller.clear();
				controller.dispose();
				rim.dispose();
				await timers.tickAsync(1000);
				assert.strictEqual(target.outerHTML, original);
			}
			assert.strictEqual(frames.callCount, 0);
			assert.strictEqual(animations.callCount, 0);
			assert.strictEqual(timers.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});
});
