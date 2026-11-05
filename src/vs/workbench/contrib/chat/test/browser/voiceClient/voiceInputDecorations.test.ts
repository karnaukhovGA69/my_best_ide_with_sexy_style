/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { mainWindow } from '../../../../../../base/browser/window.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IVoiceInputDecorationsOptions, IVoiceInputDecorationsServices, setupVoiceInputDecorations } from '../../../browser/voiceClient/voiceInputDecorations.js';

suite('Voice input decorations unavailable', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not access service dependencies, host elements or observables', () => {
		const unreadable = { get: () => { throw new Error('Input must not be read'); } };
		const services = new Proxy({} as IVoiceInputDecorationsServices, unreadable);
		const options = new Proxy({} as IVoiceInputDecorationsOptions, unreadable);
		assert.strictEqual(setupVoiceInputDecorations(services, options), Disposable.None);
	});

	test('preserves input content and styling across visibility changes without scheduling animation', async () => {
		const sandbox = sinon.createSandbox();
		const timers = sandbox.useFakeTimers();
		try {
			const frame = sandbox.spy(mainWindow, 'requestAnimationFrame');
			const input = document.createElement('div');
			input.style.position = 'static';
			input.innerHTML = '<input aria-label="Existing input">';
			const glow = document.createElement('div');
			glow.className = 'existing';
			const originalInput = input.outerHTML;
			const originalGlow = glow.outerHTML;
			const active = observableValue('active', true);
			const inputValue = observableValue('input', 'existing text');
			const getCurrentResource = sandbox.spy(() => undefined);
			const services = new Proxy({} as IVoiceInputDecorationsServices, { get: () => { throw new Error('Services must not be read'); } });
			const registration = setupVoiceInputDecorations(services, { inputContainer: input, glowContainer: glow, isActive: active, inputValue, getCurrentResource });
			assert.strictEqual(registration, Disposable.None);
			for (const visible of [false, true]) {
				active.set(visible, undefined);
				inputValue.set(visible ? '' : 'updated', undefined);
				await timers.tickAsync(1000);
				assert.strictEqual(input.outerHTML, originalInput);
				assert.strictEqual(glow.outerHTML, originalGlow);
				registration.dispose();
			}
			assert.strictEqual(getCurrentResource.callCount, 0);
			assert.strictEqual(frame.callCount, 0);
			assert.strictEqual(timers.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});
});
