/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { documentPdfFileName, documentPdfHtml, DocumentPdfRequestV1, validateDocumentPdfRequest } from '../../common/documentExport.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

suite('Document PDF export', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const request = (): DocumentPdfRequestV1 => ({ version: 1, text: 'а)1\nб)3\n\nMy essay', suggestedFileName: 'Essay.txt', page: { size: 'A4', marginMm: 20, fontFamily: 'serif', fontSizePt: 12, lineHeight: 1.5 } });

	test('preserves Unicode and blank lines without retaining mutable input', () => {
		const input = request();
		const copy = validateDocumentPdfRequest(input);
		input.page.marginMm = 30;
		assert.strictEqual(copy.page.marginMm, 20);
		assert.strictEqual(copy.text, 'а)1\nб)3\n\nMy essay');
	});

	test('rejects unsupported inputs and limits UTF-8 bytes', () => {
		for (const invalid of [undefined, null, {}, { ...request(), version: 2 }, { ...request(), text: 'я'.repeat(1024 * 1024 + 1) }, { ...request(), text: 12 }]) {
			assert.throws(() => validateDocumentPdfRequest(invalid));
		}
		for (const page of [{ fontFamily: 'serif; color:red' }, { fontSizePt: NaN }, { marginMm: Infinity }, { lineHeight: 0 }, { size: 'Letter' }]) {
			assert.throws(() => validateDocumentPdfRequest({ ...request(), page: { ...request().page, ...page } }));
		}
		assert.strictEqual(validateDocumentPdfRequest({ ...request(), text: '' }).text, '');
	});

	test('treats HTML, URLs and quotes as text', () => {
		const html = documentPdfHtml({ ...request(), text: '<script>alert(1)</script> & <img src="https://example.test/x">' });
		assert.ok(!html.includes('<script>'));
		assert.ok(!html.includes('<img'));
		assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp;'));
		assert.ok(html.includes('default-src \'none\''));
	});

	test('normalizes names without accepting a directory', () => {
		assert.strictEqual(documentPdfFileName('Essay.txt'), 'Essay.pdf');
		assert.strictEqual(documentPdfFileName(''), 'Document.pdf');
		assert.ok(!/[\\/]/.test(documentPdfFileName('../../private/file.pdf')));
		assert.ok(documentPdfFileName('a'.repeat(500)).length <= 104);
	});
});
