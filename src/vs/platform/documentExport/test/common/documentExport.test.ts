/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { documentPdfFileName, documentPdfHtml, DocumentPdfRequestV1, DocumentPdfRequestV2, validateDocumentPdfRequest } from '../../common/documentExport.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

suite('Document PDF export', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const request = (): DocumentPdfRequestV1 => ({ version: 1, text: 'а)1\nб)3\n\nMy essay', suggestedFileName: 'Essay.txt', page: { size: 'A4', marginMm: 20, fontFamily: 'serif', fontSizePt: 12, lineHeight: 1.5 } });
	const directives = (text: string): DocumentPdfRequestV2 => ({ ...request(), version: 2, format: 'directives', text });

	function directiveBody(text: string): string {
		return documentPdfHtml(directives(text)).split('<body><div class="document">')[1].split('</div></body>')[0];
	}

	test('preserves Unicode and blank lines without retaining mutable input', () => {
		const input = request();
		const copy = validateDocumentPdfRequest(input);
		input.page.marginMm = 30;
		assert.strictEqual(copy.page.marginMm, 20);
		assert.strictEqual(copy.text, 'а)1\nб)3\n\nMy essay');
	});

	test('rejects unsupported inputs and limits UTF-8 bytes', () => {
		for (const invalid of [undefined, null, {}, { ...request(), version: 2 }, { ...directives('x'), format: 'html' }, { ...directives('x'), version: 3 },
			{ ...request(), text: 'я'.repeat(1024 * 1024 + 1) }, directives('я'.repeat(1024 * 1024 + 1)), { ...request(), text: 12 }]) {
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

	test('keeps v1 literal even when an extra format field is supplied', () => {
		const input = { ...request(), text: '@title Heading\r\n@page\r\n@@note Literal' };
		const html = documentPdfHtml({ ...input, format: 'directives' });
		assert.strictEqual(html, documentPdfHtml(input));
		assert.ok(html.includes(`<div class="document">${input.text}</div>`));
	});

	test('accepts and copies an explicit v2 directives request', () => {
		const input = directives('@title Заголовок');
		const copy = validateDocumentPdfRequest(input);
		assert.deepStrictEqual(copy, input);
		assert.notStrictEqual(copy.page, input.page);
	});

	test('renders only the approved directive blocks and escapes their content', () => {
		assert.strictEqual(directiveBody('@title \tПример & <span title="x">\r@note Note \'text\'\r\nPlain <text>'),
			'<h1 class="pdf-title">Пример &amp; &lt;span title=&quot;x&quot;&gt;</h1><div class="pdf-note">Note &#39;text&#39;</div><div class="pdf-text">Plain &lt;text&gt;</div>');
	});

	test('leaves unknown, malformed, indented and escaped commands literal', () => {
		assert.strictEqual(directiveBody('@TITLE X\n @title X\n@title\t \n@note\n@page extra\n@unknown\n@@page\n@@@title X'),
			'<div class="pdf-text">@TITLE X\n @title X\n@title\t \n@note\n@page extra\n@unknown\n@page\n@@title X</div>');
	});

	test('coalesces duplicate page breaks and drops leading and trailing page breaks', () => {
		assert.strictEqual(directiveBody('@page\n\nA\n\n    \n@page \t\n\n@page\n \t\n@title B\n\nC\n\n@page\n'),
			'<div class="pdf-text">A</div><h1 class="pdf-title pdf-page-start">B</h1><div class="pdf-text">\nC</div>');
		assert.strictEqual(directiveBody('@page\n\n@page\n'), '&#8203;');
	});

	test('bounds effective manual breaks and styled DOM blocks before printing', () => {
		const withinPageLimit = Array(129).fill('content').join('\n@page\n');
		const pageLimitedHtml = documentPdfHtml(directives(withinPageLimit));
		assert.strictEqual(pageLimitedHtml.match(/class="pdf-text pdf-page-start"/g)?.length, 128);
		assert.throws(() => documentPdfHtml(directives(withinPageLimit + '\n@page\ncontent')), /128 manual page breaks/);
		const withinBlockLimit = '@title Heading\n@note Note\n'.repeat(2048);
		assert.doesNotThrow(() => documentPdfHtml(directives(withinBlockLimit)));
		assert.throws(() => documentPdfHtml(directives(withinBlockLimit + '@title Heading')), /4096 titles and notes/);
	});

	test('normalizes names without accepting a directory', () => {
		assert.strictEqual(documentPdfFileName('Essay.txt'), 'Essay.pdf');
		assert.strictEqual(documentPdfFileName(''), 'Document.pdf');
		assert.ok(!/[\\/]/.test(documentPdfFileName('../../private/file.pdf')));
		assert.ok(documentPdfFileName('a'.repeat(500)).length <= 104);
	});
});
