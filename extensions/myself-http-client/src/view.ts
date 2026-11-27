/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'node:crypto';

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderResponse(title: string, status: string, text: string, limitNotice: string, language: string): string {
	const nonce = randomBytes(16).toString('base64');
	return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)}</title><style nonce="${nonce}">
body{margin:0;padding:16px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);font-family:var(--vscode-font-family);font-size:var(--vscode-font-size)}
h1{font-size:1.4em;margin:0 0 .65em}
p{color:var(--vscode-descriptionForeground)}
pre{border-block-start:1px solid var(--vscode-panel-border);padding-block-start:1em;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--vscode-editor-font-family);unicode-bidi:isolate}
</style></head><body><main><h1>${escapeHtml(status)}</h1>${limitNotice ? `<p>${escapeHtml(limitNotice)}</p>` : ''}<pre>${escapeHtml(text)}</pre></main></body></html>`;
}
