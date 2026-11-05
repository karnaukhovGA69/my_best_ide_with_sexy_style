/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IObservable } from '../../../../../base/common/observable.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChatSpeechToTextState, IChatSpeechToTextService } from '../../browser/speechToText/chatSpeechToTextService.js';
import { easeDictationMicLevel, getDictationMicGlowPhase, shapeDictationMicLevel, setupDictationMicGlow } from '../../browser/speechToText/dictationMicGlow.js';

suite('DictationMicGlow', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('recording glows, transcribing winds down, and preparing suppresses the glow', () => {
		const states = [ChatSpeechToTextState.Idle, ChatSpeechToTextState.Recording, ChatSpeechToTextState.Transcribing];
		assert.deepStrictEqual(
			{
				ready: states.map(state => getDictationMicGlowPhase(state, false)),
				preparing: states.map(state => getDictationMicGlowPhase(state, true)),
			},
			{
				ready: ['off', 'live', 'settling'],
				preparing: ['off', 'off', 'off'],
			}
		);
	});

	test('the level swells faster than it drifts back, so speech reads as ambient', () => {
		const rose = easeDictationMicLevel(0, 1);
		const fell = 1 - easeDictationMicLevel(1, 0);
		assert.deepStrictEqual(
			{ rose: Number(rose.toFixed(3)), fell: Number(fell.toFixed(3)), releaseIsSlower: fell < rose },
			{ rose: 0.1, fell: 0.035, releaseIsSlower: true }
		);
	});

	test('the level is lifted at the quiet end and clamped at both ends', () => {
		assert.deepStrictEqual(
			[0, 0.25, 1, 1.5, -1].map(l => Number(shapeDictationMicLevel(l).toFixed(3))),
			[0, 0.436, 1, 1, 0]
		);
	});

	test('does not read services, subscribe to activity or touch host styles', () => {
		const unreadable = { get: () => { throw new Error('Input must not be read'); } };
		const service = new Proxy({} as IChatSpeechToTextService, unreadable);
		const accessibility = new Proxy({} as IAccessibilityService, unreadable);
		const theme = new Proxy({} as IThemeService, unreadable);
		const active = new Proxy({} as IObservable<boolean>, unreadable);
		const target = document.createElement('button');
		target.className = 'existing';
		target.style.color = 'red';
		const original = target.outerHTML;
		const registration = setupDictationMicGlow(target, service, accessibility, active, theme);
		assert.strictEqual(registration, Disposable.None);
		assert.strictEqual(target.outerHTML, original);
		registration.dispose();
		assert.strictEqual(target.outerHTML, original);
		assert.strictEqual(setupDictationMicGlow(new Proxy({} as HTMLElement, unreadable), service, accessibility), Disposable.None);
	});
});
