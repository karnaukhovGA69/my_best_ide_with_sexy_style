/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { JsonNumber, JsonValue, maxOutputBytes, PreviewData, PreviewError } from './model';

export interface PreviewLabels {
	readonly title: string;
	readonly language: string;
	readonly snapshot: string;
	readonly object: string;
	readonly array: string;
	readonly row: string;
	readonly emptyCsv: string;
}

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, character => entities[character]);
}

class HtmlBuffer {
	private readonly parts: string[] = [];
	private bytes = 0;

	add(html: string): void {
		this.bytes += Buffer.byteLength(html, 'utf8');
		if (this.bytes > maxOutputBytes) {
			throw new PreviewError('output-size');
		}
		this.parts.push(html);
	}

	toString(): string {
		return this.parts.join('');
	}
}

const styles = `
body{padding:16px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);font-family:var(--vscode-font-family);font-size:var(--vscode-font-size)}
h1{font-size:1.4em;margin:0 0 .4em;overflow-wrap:anywhere}
p{color:var(--vscode-descriptionForeground);margin:.2em 0 1em}
details>div{margin-inline-start:1.2em}
summary{cursor:pointer;margin:.15em 0}
summary:focus-visible,.table-wrap:focus-visible{outline:1px solid var(--vscode-focusBorder)}
code,td{font-family:var(--vscode-editor-font-family);white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:isolate}
.kind{color:var(--vscode-descriptionForeground)}
.table-wrap{overflow:auto}
table{border-collapse:collapse}
th,td{border:1px solid var(--vscode-panel-border);padding:.35em .6em;text-align:start;vertical-align:top}
th{background:var(--vscode-editorWidget-background)}
td{min-width:4em;max-width:24em}
`;

function renderJson(out: HtmlBuffer, value: JsonValue, labels: PreviewLabels, name = '', expanded = false): void {
	const prefix = name ? `<code>${escapeHtml(name)}</code>: ` : '';
	if (value instanceof JsonNumber || typeof value !== 'object' || value === null) {
		const text = value instanceof JsonNumber ? value.source : JSON.stringify(value);
		out.add(`<div>${prefix}<code>${escapeHtml(text)}</code></div>`);
		return;
	}
	const children = Object.entries(value);
	const isArray = Array.isArray(value);
	const kind = escapeHtml(isArray ? labels.array : labels.object);
	out.add(`<details${expanded ? ' open' : ''}><summary>${prefix}<span class="kind">${kind} (${children.length})</span></summary><div>`);
	for (const [key, child] of children) {
		renderJson(out, child, labels, isArray ? `[${key}]` : JSON.stringify(key));
	}
	out.add('</div></details>');
}

function renderCsv(out: HtmlBuffer, rows: string[][], labels: PreviewLabels): void {
	if (!rows.length) {
		out.add(`<p>${escapeHtml(labels.emptyCsv)}</p>`);
		return;
	}
	const columns = Math.max(...rows.map(row => row.length));
	out.add(`<div class="table-wrap" tabindex="0"><table><thead><tr><th scope="col">${escapeHtml(labels.row)}</th>`);
	for (let column = 1; column <= columns; column++) {
		out.add(`<th scope="col">${column}</th>`);
	}
	out.add('</tr></thead><tbody>');
	for (const [index, row] of rows.entries()) {
		out.add(`<tr><th scope="row">${index + 1}</th>`);
		for (let column = 0; column < columns; column++) {
			out.add(`<td>${escapeHtml(row[column] ?? '')}</td>`);
		}
		out.add('</tr>');
	}
	out.add('</tbody></table></div>');
}

export function renderPreview(data: PreviewData, labels: PreviewLabels): string {
	const nonce = randomBytes(16).toString('base64');
	const out = new HtmlBuffer();
	const title = escapeHtml(labels.title);
	out.add(`<!doctype html><html lang="${escapeHtml(labels.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><title>${title}</title><style nonce="${nonce}">${styles}</style></head><body><main><h1>${title}</h1><p>${escapeHtml(labels.snapshot)}</p>`);
	if (data.format === 'json') {
		renderJson(out, data.value, labels, '', true);
	} else {
		renderCsv(out, data.rows, labels);
	}
	out.add('</main></body></html>');
	return out.toString();
}
