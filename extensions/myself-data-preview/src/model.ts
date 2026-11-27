/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Buffer } from 'node:buffer';

export const maxInputBytes = 1024 * 1024;
export const maxOutputBytes = 512 * 1024;
export const maxCsvRows = 200;
export const maxCsvColumns = 40;
export const maxJsonDepth = 32;
export const maxJsonValues = 2048;

export type PreviewFormat = 'json' | 'csv';
export type PreviewErrorCode = 'input-size' | 'output-size' | 'invalid-csv' | 'csv-rows' | 'csv-columns'
	| 'invalid-json' | 'json-depth' | 'json-values';

export class PreviewError extends Error {
	constructor(readonly code: PreviewErrorCode) {
		super(code);
	}
}

export class JsonNumber {
	constructor(readonly source: string) { }
}

export type JsonValue = string | boolean | null | JsonNumber | JsonValue[] | { [key: string]: JsonValue };
export type PreviewData = { format: 'json'; value: JsonValue } | { format: 'csv'; rows: string[][] };

export function getPreviewFormat(scheme: string, authority: string, path: string): PreviewFormat | undefined {
	if (scheme !== 'file' || authority) {
		return undefined;
	}
	const name = path.toLowerCase();
	if (name.endsWith('.json')) {
		return 'json';
	}
	if (name.endsWith('.csv')) {
		return 'csv';
	}
	return undefined;
}

export function parsePreview(format: PreviewFormat, text: string): PreviewData {
	if (text.length > maxInputBytes || Buffer.byteLength(text, 'utf8') > maxInputBytes) {
		throw new PreviewError('input-size');
	}
	const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
	return format === 'json' ? { format, value: parseJson(source) } : { format, rows: parseCsv(source) };
}

function checkJsonDepth(source: string): void {
	let depth = 0;
	let quoted = false;
	for (let i = 0; i < source.length; i++) {
		const character = source[i];
		if (quoted) {
			if (character === '\\') {
				i++;
			} else if (character === '"') {
				quoted = false;
			}
		} else if (character === '"') {
			quoted = true;
		} else if (character === '{' || character === '[') {
			if (++depth > maxJsonDepth) {
				throw new PreviewError('json-depth');
			}
		} else if (character === '}' || character === ']') {
			depth--;
		}
	}
}

function parseJson(source: string): JsonValue {
	// Bound the depth before JSON.parse traverses the tree to call the reviver.
	checkJsonDepth(source);
	let values = 0;
	try {
		return JSON.parse(source, (_key: string, value: unknown, context?: { source: string }) => {
			if (++values > maxJsonValues) {
				throw new PreviewError('json-values');
			}
			if (typeof value === 'number') {
				return new JsonNumber(context?.source ?? (Object.is(value, -0) ? '-0' : String(value)));
			}
			return value;
		}) as JsonValue;
	} catch (error) {
		if (error instanceof PreviewError) {
			throw error;
		}
		throw new PreviewError('invalid-json');
	}
}

type CsvFieldState = 'start' | 'unquoted' | 'quoted' | 'afterQuote';

function parseCsv(source: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let state: CsvFieldState = 'start';
	let recordStarted = false;

	function endField(): void {
		if (row.length >= maxCsvColumns) {
			throw new PreviewError('csv-columns');
		}
		row.push(field);
		field = '';
	}

	function endRecord(): void {
		endField();
		if (rows.length >= maxCsvRows) {
			throw new PreviewError('csv-rows');
		}
		rows.push(row);
		row = [];
	}

	for (let i = 0; i < source.length; i++) {
		const character = source[i];
		if (state === 'quoted') {
			if (character !== '"') {
				field += character;
			} else if (source[i + 1] === '"') {
				field += '"';
				i++;
			} else {
				state = 'afterQuote';
			}
			continue;
		}

		if (character === '\r' || character === '\n') {
			endRecord();
			recordStarted = false;
			state = 'start';
			if (character === '\r' && source[i + 1] === '\n') {
				i++;
			}
			continue;
		}

		recordStarted = true;
		if (character === ',') {
			endField();
			state = 'start';
		} else if (state === 'afterQuote' || (character === '"' && state !== 'start')) {
			throw new PreviewError('invalid-csv');
		} else if (character === '"') {
			state = 'quoted';
		} else {
			field += character;
			state = 'unquoted';
		}
	}

	if (state === 'quoted') {
		throw new PreviewError('invalid-csv');
	}
	if (recordStarted) {
		endRecord();
	}
	return rows;
}
