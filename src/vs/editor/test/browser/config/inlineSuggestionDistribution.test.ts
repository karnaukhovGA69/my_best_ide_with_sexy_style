/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { isEditorConfigurationKey } from '../../../common/config/editorConfigurationSchema.js';
import { EditorOptions } from '../../../common/config/editorOptions.js';

suite('Inline suggestion settings distribution', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('retired inline settings are absent while normal suggestions remain configurable', () => {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		assert.deepStrictEqual(Object.keys(properties).filter(key => key.startsWith('editor.inlineSuggest.')), []);
		assert.strictEqual(isEditorConfigurationKey('inlineSuggest.enabled'), false);
		assert.ok(properties['editor.quickSuggestions']);
		assert.ok(properties['editor.suggest.showMethods']);
	});

	test('retains editor option validation for API compatibility', () => {
		const options = EditorOptions.inlineSuggest.validate({ enabled: true, mode: 'subword', minShowDelay: -1, edits: { enabled: true, renderSideBySide: 'never' } });
		assert.strictEqual(options.enabled, true);
		assert.strictEqual(options.mode, 'subword');
		assert.strictEqual(options.minShowDelay, 0);
		assert.strictEqual(options.edits.enabled, true);
		assert.strictEqual(options.edits.renderSideBySide, 'never');
	});
});
