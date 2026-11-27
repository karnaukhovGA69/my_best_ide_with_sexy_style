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

export interface DocumentPdfRequestV2 extends Omit<DocumentPdfRequestV1, 'version'> {
	version: 2;
	format: 'directives';
}

export type DocumentPdfRequest = DocumentPdfRequestV1 | DocumentPdfRequestV2;
export type DocumentPdfResultV1 = { status: 'saved'; uri: string } | { status: 'cancelled' };

export function validateDocumentPdfRequest(input: unknown): DocumentPdfRequest {
	const value = input as DocumentPdfRequest | undefined;
	const page = value?.page;
	const inRange = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
	if (!value || (value.version !== 1 && !(value.version === 2 && value.format === 'directives'))
		|| typeof value.text !== 'string' || value.text.length > 2 * 1024 * 1024 || new TextEncoder().encode(value.text).byteLength > 2 * 1024 * 1024
		|| typeof value.suggestedFileName !== 'string' || !page || page.size !== 'A4'
		|| !['sans-serif', 'serif', 'monospace'].includes(page.fontFamily)
		|| !inRange(page.marginMm, 10, 30) || !inRange(page.fontSizePt, 10, 24) || !inRange(page.lineHeight, 1, 2)) {
		throw new Error('Invalid PDF export request. Use plain text up to 2 MiB and supported page settings.');
	}
	const request: Omit<DocumentPdfRequestV1, 'version'> = {
		text: value.text,
		suggestedFileName: value.suggestedFileName,
		page: { size: 'A4', marginMm: page.marginMm, fontFamily: page.fontFamily, fontSizePt: page.fontSizePt, lineHeight: page.lineHeight },
	};
	return value.version === 1
		? { version: 1, ...request }
		: { version: 2, format: 'directives', ...request };
}

export function documentPdfFileName(name: string): string {
	const normalized = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').replace(/\.(txt|pdf)$/i, '').slice(0, 100).trim();
	return `${normalized || 'Document'}.pdf`;
}

function escapeDocumentPdfText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const maxManualPageBreaks = 128;
const maxDecoratedBlocks = 4096;
const directiveStyles = '.pdf-title{font-size:1.5em;font-weight:700;margin:0 0 .4em;break-after:avoid}.pdf-note{border-inline-start:.2em solid currentColor;padding-inline-start:.7em;margin:.25em 0}.pdf-page-start{break-before:page}';

interface PdfTextBlock {
	kind: 'text' | 'title' | 'note';
	text: string;
}

/** Each nonempty section after the first starts on a new page. */
function parseDocumentPdfDirectives(text: string): PdfTextBlock[][] {
	const sections: PdfTextBlock[][] = [];
	let blocks: PdfTextBlock[] = [];
	let lines: string[] = [];
	let atPageBoundary = false;
	let decoratedBlocks = 0;

	function flushText(): void {
		if (lines.length) {
			blocks.push({ kind: 'text', text: lines.join('\n') });
			lines = [];
		}
	}

	function finishSection(): void {
		flushText();
		if (blocks.length) {
			if (sections.length > maxManualPageBreaks) {
				throw new Error(`PDF formatting supports up to ${maxManualPageBreaks} manual page breaks.`);
			}
			sections.push(blocks);
			blocks = [];
		}
	}

	for (const line of text.split(/\r\n|\r|\n/)) {
		if (/^@page[ \t]*$/.test(line)) {
			while (lines.at(-1)?.trim() === '') {
				lines.pop();
			}
			finishSection();
			atPageBoundary = true;
			continue;
		}
		if (atPageBoundary && !line.trim()) {
			continue;
		}
		atPageBoundary = false;
		if (line.startsWith('@@')) {
			lines.push(line.slice(1));
			continue;
		}
		const directive = /^@(?<kind>title|note)[ \t]+(?<text>[^\r\n]*)$/u.exec(line)?.groups;
		if (directive?.text.trim() && (directive.kind === 'title' || directive.kind === 'note')) {
			if (++decoratedBlocks > maxDecoratedBlocks) {
				throw new Error(`PDF formatting supports up to ${maxDecoratedBlocks} titles and notes combined.`);
			}
			flushText();
			blocks.push({ kind: directive.kind, text: directive.text });
		} else {
			lines.push(line);
		}
	}
	finishSection();
	return sections;
}

function documentPdfDirectiveBody(text: string): string {
	return parseDocumentPdfDirectives(text).map((blocks, sectionIndex) => blocks.map((block, blockIndex) => {
		const pageStart = sectionIndex > 0 && blockIndex === 0 ? ' pdf-page-start' : '';
		const content = escapeDocumentPdfText(block.text) || '&#8203;';
		switch (block.kind) {
			case 'title': return `<h1 class="pdf-title${pageStart}">${content}</h1>`;
			case 'note': return `<div class="pdf-note${pageStart}">${content}</div>`;
			case 'text': return `<div class="pdf-text${pageStart}">${content}</div>`;
		}
	}).join('')).join('');
}

export function documentPdfHtml(input: unknown): string {
	const request = validateDocumentPdfRequest(input);
	const body = request.version === 2 ? documentPdfDirectiveBody(request.text) : escapeDocumentPdfText(request.text);
	const styles = request.version === 2 ? directiveStyles : '';
	const fonts = { 'sans-serif': 'Arial, sans-serif', serif: 'Georgia, serif', monospace: 'Courier New, monospace' };
	return `<!doctype html><html><head><meta charset="utf-8"><title>Document</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>@page{size:A4}html,body{margin:0;padding:0;background:white;color:black}body{font-family:${fonts[request.page.fontFamily]};font-size:${request.page.fontSizePt}pt;line-height:${request.page.lineHeight}}.document{white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;orphans:2;widows:2}${styles}</style></head><body><div class="document">${body || '&#8203;'}</div></body></html>`;
}
