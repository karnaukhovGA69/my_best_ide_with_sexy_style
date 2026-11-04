/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface DocumentPdfRequestV1 {
	version: 1;
	text: string;
	suggestedFileName: string;
	page: { size: 'A4'; marginMm: number; fontFamily: 'sans-serif' | 'serif' | 'monospace'; fontSizePt: number; lineHeight: number };
}

export type DocumentPdfResultV1 = { status: 'saved'; uri: string } | { status: 'cancelled' };

export function validateDocumentPdfRequest(input: unknown): DocumentPdfRequestV1 {
	const value = input as DocumentPdfRequestV1 | undefined;
	const page = value?.page;
	const inRange = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
	if (!value || value.version !== 1 || typeof value.text !== 'string' || value.text.length > 2 * 1024 * 1024 || new TextEncoder().encode(value.text).byteLength > 2 * 1024 * 1024
		|| typeof value.suggestedFileName !== 'string' || !page || page.size !== 'A4'
		|| !['sans-serif', 'serif', 'monospace'].includes(page.fontFamily)
		|| !inRange(page.marginMm, 10, 30) || !inRange(page.fontSizePt, 10, 24) || !inRange(page.lineHeight, 1, 2)) {
		throw new Error('Invalid PDF export request. Use plain text up to 2 MiB and supported page settings.');
	}
	return { version: 1, text: value.text, suggestedFileName: value.suggestedFileName, page: { size: 'A4', marginMm: page.marginMm, fontFamily: page.fontFamily, fontSizePt: page.fontSizePt, lineHeight: page.lineHeight } };
}

export function documentPdfFileName(name: string): string {
	const normalized = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').replace(/\.(txt|pdf)$/i, '').slice(0, 100).trim();
	return `${normalized || 'Document'}.pdf`;
}

export function documentPdfHtml(input: unknown): string {
	const request = validateDocumentPdfRequest(input);
	const text = request.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	const fonts = { 'sans-serif': 'Arial, sans-serif', serif: 'Georgia, serif', monospace: 'Courier New, monospace' };
	return `<!doctype html><html><head><meta charset="utf-8"><title>Document</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>@page{size:A4}html,body{margin:0;padding:0;background:white;color:black}body{font-family:${fonts[request.page.fontFamily]};font-size:${request.page.fontSizePt}pt;line-height:${request.page.lineHeight}}.document{white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;orphans:2;widows:2}</style></head><body><div class="document">${text || '&#8203;'}</div></body></html>`;
}
