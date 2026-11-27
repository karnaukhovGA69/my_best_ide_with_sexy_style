/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { assessExtension, selectedExtensions } from '../../common/installationDiagnostics.js';

suite('Installation Diagnostics Model', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const [clangd, cpp, basedPyright, python] = selectedExtensions;

	test('reports enablement and activation independently when reload is pending', () => {
		assert.deepStrictEqual(assessExtension(clangd, { enabled: false, activation: { started: true, succeeded: true } }), {
			extension: clangd,
			installation: 'installed',
			enablement: 'disabled',
			activation: 'activated',
			languageServer: 'unverified',
		});
	});

	test('keeps the language server unverified at each stage of extension activation', () => {
		const results = [
			assessExtension(basedPyright, 'notListed'),
			assessExtension(basedPyright, { enabled: false, activation: undefined }),
			assessExtension(basedPyright, { enabled: true, activation: { started: false, succeeded: false } }),
			assessExtension(basedPyright, { enabled: true, activation: { started: true, succeeded: false } }),
			assessExtension(basedPyright, { enabled: true, activation: { started: true, succeeded: true } }),
		];
		assert.deepStrictEqual(results.map(({ activation, languageServer }) => [activation, languageServer]), [
			['notApplicable', 'unverified'],
			['unavailable', 'unverified'],
			['notActivated', 'unverified'],
			['unavailable', 'unverified'],
			['activated', 'unverified'],
		]);
	});

	test('distinguishes unavailable inventory from absence in a successful inventory', () => {
		assert.deepStrictEqual(assessExtension(clangd, 'unavailable'), {
			extension: clangd,
			installation: 'unavailable',
			enablement: 'unavailable',
			activation: 'unavailable',
			languageServer: 'unverified',
		});
		assert.deepStrictEqual(assessExtension(clangd, 'notListed'), {
			extension: clangd,
			installation: 'notListed',
			enablement: 'notApplicable',
			activation: 'notApplicable',
			languageServer: 'unverified',
		});
	});

	test('marks only the syntax packages as having no applicable language server check', () => {
		assert.deepStrictEqual(
			[cpp, python].map(extension => assessExtension(extension, { enabled: true, activation: undefined }).languageServer),
			['notApplicable', 'notApplicable'],
		);
	});
});
