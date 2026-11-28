/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

function vectorDocument({ pageCount = 2, dimensions = '40 40', font } = {}) {
	const stream = content => `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (this.print\(\);) >> >>',
		`<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 6} 0 R`).join(' ')}] >>`,
		stream(font === 'standard' ? 'BT /F1 22 Tf 3 10 Td (HELLO) Tj ET'
			: font === 'embedded' ? 'BT /F1 32 Tf 2 5 Td (A) Tj ET' : '1 0 0 rg 0 0 40 40 re f'),
		stream('0 0 1 rg 0 0 40 40 re f'),
		'<< /Type /Annot /Subtype /Link /Rect [0 0 40 40] /A << /S /URI /URI (https://pdf-annotation.invalid/) >> >>',
	];
	const resources = font ? `<< /Font << /F1 ${6 + pageCount} 0 R >> >>` : '<< >>';
	for (let index = 0; index < pageCount; index++) {
		objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${dimensions}] /Resources ${resources} /Contents ${index % 2 + 3} 0 R /Annots [5 0 R] >>`);
	}
	if (font === 'standard') { objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); }
	if (font === 'embedded') {
		objects.push(`<< /Type /Font /Subtype /Type3 /FontBBox [0 0 900 900] /FontMatrix [0.001 0 0 0.001 0 0]
			/CharProcs << /A ${7 + pageCount} 0 R >> /Encoding << /Type /Encoding /Differences [65 /A] >>
			/FirstChar 65 /LastChar 65 /Widths [900] /Resources << >> >>`);
		objects.push(stream('900 0 0 0 900 900 d1 0 0 900 900 re f'));
	}
	let pdf = '%PDF-1.7\n';
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(Buffer.byteLength(pdf));
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xref = Buffer.byteLength(pdf);
	pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
	for (const offset of offsets.slice(1)) { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; }
	return Buffer.from(pdf + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

module.exports = { vectorDocument };
