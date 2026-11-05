/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { textChange, normalizeText, exportDocument, defaultPage, exportCommand, isPageOptions } = require('../out/document.js');

test('minimal edits preserve paragraphs, Unicode and CRLF', () => {
	for (const [before, input, eol] of [
		['а)1\r\n\r\nб)3', 'а)1\n\nб)3\nEssay 😀', '\r\n'],
		['Essay 😀', 'Essay 🧑', '\n'], ['', 'а)1\nб)3\n\n', '\n'], ['delete', '', '\n']
	]) {
		const change = textChange(before, input, eol);
		const result = before.slice(0, change.start) + change.text + before.slice(change.end);
		assert.equal(result, normalizeText(input).replace(/\n/g, eol));
	}
	assert.equal(textChange('а\r\nб', 'а\nб', '\r\n'), undefined);
});

test('PDF adapter sends exactly DTO v1 and preserves plain text', async () => {
	let sent;
	const result = await exportDocument({ getCommands: async () => [exportCommand], execute: async request => { sent = request; return { status: 'saved', uri: 'file:///document.pdf' }; } }, '<b>а)1</b>\n\nб)3', 'Essay.pdf', defaultPage);
	assert.deepEqual({ sent, result }, {
		sent: { version: 1, text: '<b>а)1</b>\n\nб)3', suggestedFileName: 'Essay.pdf', page: defaultPage },
		result: { status: 'saved', uri: 'file:///document.pdf' }
	});
});

test('PDF cancel, missing backend, rejection and malformed results stay distinct', async () => {
	const commands = execute => ({ getCommands: async () => [exportCommand], execute });
	assert.deepEqual(await exportDocument(commands(async () => ({ status: 'cancelled' })), '', 'Blank.pdf', defaultPage), { status: 'cancelled' });
	await assert.rejects(exportDocument({ getCommands: async () => [], execute: async () => assert.fail('must not execute') }, '', 'Blank.pdf', defaultPage), /missing-backend/);
	await assert.rejects(exportDocument(commands(async () => { throw new Error('write denied'); }), '', 'Blank.pdf', defaultPage), /write denied/);
	await assert.rejects(exportDocument(commands(async () => undefined), '', 'Blank.pdf', defaultPage), /invalid-result/);
});

test('page constraints and UTF-8 limit are enforced before invoking the backend', async () => {
	for (const page of [{ ...defaultPage, marginMm: 31 }, { ...defaultPage, fontSizePt: NaN }, { ...defaultPage, fontFamily: 'url(http://example.invalid)' }, { ...defaultPage, lineHeight: 0 }, { ...defaultPage, fontFamily: ['serif'] }]) {
		assert.equal(isPageOptions(page), false);
	}
	await assert.rejects(exportDocument({ getCommands: async () => assert.fail('too large'), execute: async () => {} }, 'я'.repeat(1024 * 1024 + 1), 'Essay.pdf', defaultPage), /too-large/);
});
