/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const exportCommand = 'myself.documents.exportPdf';
export const maxTextBytes = 2 * 1024 * 1024;

export interface PageOptions {
	size: 'A4';
	marginMm: number;
	fontFamily: 'sans-serif' | 'serif' | 'monospace';
	fontSizePt: number;
	lineHeight: number;
}

export const defaultPage: Readonly<PageOptions> = { size: 'A4', marginMm: 20, fontFamily: 'serif', fontSizePt: 12, lineHeight: 1.5 };

export interface DocumentPdfRequestV1 {
	version: 1;
	text: string;
	suggestedFileName: string;
	page: PageOptions;
}

export type DocumentPdfResultV1 = { status: 'saved'; uri: string } | { status: 'cancelled' };

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isPageOptions(value: unknown): value is PageOptions {
	if (!isRecord(value)) {
		return false;
	}
	const inRange = (n: unknown, min: number, max: number): boolean => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
	return value.size === 'A4' && typeof value.fontFamily === 'string' && ['sans-serif', 'serif', 'monospace'].includes(value.fontFamily)
		&& inRange(value.marginMm, 10, 30) && inRange(value.fontSizePt, 10, 24) && inRange(value.lineHeight, 1, 2);
}

export function normalizeText(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}

/** Compute one minimal replacement, keeping the document's existing line endings. */
export function textChange(previous: string, next: string, eol: string): { start: number; end: number; text: string } | undefined {
	next = normalizeText(next).replace(/\n/g, eol);
	if (previous === next) {
		return undefined;
	}
	let start = 0;
	while (start < previous.length && start < next.length && previous[start] === next[start]) {
		start++;
	}
	let end = previous.length;
	let nextEnd = next.length;
	while (end > start && nextEnd > start && previous[end - 1] === next[nextEnd - 1]) {
		end--;
		nextEnd--;
	}
	return { start, end, text: next.slice(start, nextEnd) };
}

export interface ExportCommands {
	getCommands(): Thenable<string[]>;
	execute(request: DocumentPdfRequestV1): Thenable<unknown>;
}

/** No PDF implementation here: all exports go through the workbench's DTO v1. */
export async function exportDocument(commands: ExportCommands, text: string, fileName: string, page: PageOptions): Promise<DocumentPdfResultV1> {
	if (!isPageOptions(page)) {
		throw new Error('invalid-page');
	}
	if (Buffer.byteLength(text, 'utf8') > maxTextBytes) {
		throw new Error('too-large');
	}
	if (!(await commands.getCommands()).includes(exportCommand)) {
		throw new Error('missing-backend');
	}
	const result = await commands.execute({
		version: 1, text, suggestedFileName: fileName,
		page: { size: 'A4', marginMm: page.marginMm, fontFamily: page.fontFamily, fontSizePt: page.fontSizePt, lineHeight: page.lineHeight }
	});
	if (isRecord(result) && result.status === 'cancelled') {
		return { status: 'cancelled' };
	}
	if (isRecord(result) && result.status === 'saved' && typeof result.uri === 'string') {
		return { status: 'saved', uri: result.uri };
	}
	throw new Error('invalid-result');
}
