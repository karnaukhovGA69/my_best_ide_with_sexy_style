/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { DEFAULT_CUSTOM_TITLEBAR_HEIGHT } from '../../../../../platform/window/common/window.js';
import { NativeTitlebarPart } from '../../../../electron-browser/parts/titlebar/titlebarPart.js';
import { LayoutSettings } from '../../../../services/layout/browser/layoutService.js';

suite('Calmer Studio native title height', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('macOS override retains Calmer height with or without Command Center', () => {
		const configurationService = new TestConfigurationService({ [LayoutSettings.CALMER_STUDIO]: true });
		store.add(configurationService.onDidChangeConfigurationEmitter);
		for (const isCommandCenterVisible of [false, true]) {
			const receiver = { configurationService, isCommandCenterVisible, preventZoom: false };
			assert.strictEqual(Reflect.get(NativeTitlebarPart.prototype, 'minimumHeight', receiver), 48);
			assert.strictEqual(Reflect.get(NativeTitlebarPart.prototype, 'maximumHeight', { minimumHeight: 48 }), 48);
		}
	});

	test('Modern takes precedence without changing native defaults', () => {
		const configurationService = new TestConfigurationService({ [LayoutSettings.CALMER_STUDIO]: true, [LayoutSettings.MODERN_UI]: true });
		store.add(configurationService.onDidChangeConfigurationEmitter);
		const receiver = { configurationService, isCommandCenterVisible: true, preventZoom: false };
		assert.strictEqual(Reflect.get(NativeTitlebarPart.prototype, 'minimumHeight', receiver), DEFAULT_CUSTOM_TITLEBAR_HEIGHT);
	});
});
