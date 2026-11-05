/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { mergeSettingsFile, parseSettingsFile, portableSettings, settingsTransferMaxBytes } from '../../common/settingsTransfer.js';

suite('Local settings file format', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('accepts JSONC, trailing commas, BOM, Unicode and nested values', () => {
		assert.deepStrictEqual(parseSettingsFile('\uFEFF{ // настройки\n"editor.fontFamily": "Моно", "files.associations": {"*.notes":"text",}, "editor.rulers": [80,120], }'), {
			'editor.fontFamily': 'Моно', 'files.associations': { '*.notes': 'text' }, 'editor.rulers': [80, 120]
		});
	});

	test('rejects malformed, non-object, non-finite and prototype-shaped input', () => {
		for (const text of ['', '[]', 'null', 'true', '{ broken }', '{"editor.fontSize":1e999}', '{"__proto__":{}}', '{"example.data":{"constructor":{}}}']) {
			assert.throws(() => parseSettingsFile(text));
		}
	});

	test('enforces the UTF-8 size limit and bounded nesting', () => {
		assert.throws(() => parseSettingsFile(JSON.stringify({ 'test.data': 'я'.repeat(settingsTransferMaxBytes / 2) })), /2 MiB/);
		assert.throws(() => parseSettingsFile('{"test.data":' + '['.repeat(35) + '1' + ']'.repeat(35) + '}'));
	});

	test('omits sensitive keys, nested credentials, retired and machine settings in both directions', () => {
		const source = JSON.stringify({
			'editor.fontSize': 14, 'example.apiKey': 'fixture', 'example.headers': { Authorization: 'fixture' },
			'http.proxy': 'https://name:fixture@example.invalid', 'github.example': true, 'chat.example': true,
			'editor.inlineSuggest.enabled': true, 'git.path': '/example/git',
			'[typescript]': { 'editor.tabSize': 4, 'example.secret': 'fixture' },
		});
		const result = portableSettings(source, key => key === 'git.path');
		assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
			settings: { 'editor.fontSize': 14, '[typescript]': { 'editor.tabSize': 4 } },
			omitted: ['example.apiKey', 'example.headers', 'http.proxy', 'github.example', 'chat.example', 'editor.inlineSuggest.enabled', 'git.path', '[typescript].example.secret']
		});
		assert.deepStrictEqual(JSON.parse(JSON.stringify(portableSettings(JSON.stringify(result.settings)).settings)), JSON.parse(JSON.stringify(result.settings)));
	});

	test('keeps token color customizations and filters sensitive values in arrays', () => {
		const result = portableSettings(JSON.stringify({
			'editor.tokenColorCustomizations': { comments: '#123456' }, 'editor.semanticTokenColorCustomizations': { enabled: true },
			'example.items': [{ password: 'fixture' }], 'example.header': 'Bearer fixture-only',
		}));
		assert.deepStrictEqual(Object.keys(result.settings), ['editor.tokenColorCustomizations', 'editor.semanticTokenColorCustomizations']);
	});

	test('merges settings and language overrides without losing unrelated JSONC', () => {
		const current = '{\r\n  // keep this comment\r\n  "editor.fontSize": 12,\r\n  "files.autoSave": "off",\r\n  "[typescript]": {"editor.tabSize": 2, "editor.insertSpaces": true}\r\n}';
		const result = mergeSettingsFile(current, { 'editor.fontSize': 16, '[typescript]': { 'editor.tabSize': 4 }, 'workbench.colorTheme': 'Dark' });
		assert.deepStrictEqual({ changed: result.changed, parsed: parseSettingsFile(result.content), comment: result.content.includes('// keep this comment'), lfOnly: /(?<!\r)\n/.test(result.content) }, {
			changed: 3, parsed: { 'editor.fontSize': 16, 'files.autoSave': 'off', '[typescript]': { 'editor.tabSize': 4, 'editor.insertSpaces': true }, 'workbench.colorTheme': 'Dark' }, comment: true, lfOnly: false
		});
	});

	test('unchanged imports preserve the exact existing contents', () => {
		const current = '{ // keep\n "editor.fontSize": 14\n}';
		assert.deepStrictEqual(mergeSettingsFile(current, { 'editor.fontSize': 14 }), { content: current, changed: 0 });
	});

	test('supports an empty local file and rejects invalid language overrides', () => {
		assert.deepStrictEqual(parseSettingsFile(mergeSettingsFile('', { '[go]': { 'editor.tabSize': 4 } }).content), { '[go]': { 'editor.tabSize': 4 } });
		assert.throws(() => portableSettings('{"[go]": true}'), /Language settings/);
		assert.throws(() => mergeSettingsFile('{"[go]":true}', { '[go]': { 'editor.tabSize': 4 } }), /invalid language settings/);
	});

	test('rejects a merged result exceeding the size limit', () => {
		const current = JSON.stringify({ 'example.first': 'a'.repeat(settingsTransferMaxBytes / 2) });
		assert.throws(() => mergeSettingsFile(current, { 'example.second': 'b'.repeat(settingsTransferMaxBytes / 2) }), /2 MiB/);
	});
});
