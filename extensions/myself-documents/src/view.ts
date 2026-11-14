/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';

function escape(value: string): string {
	return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!);
}

export function editorHtml(webview: vscode.Webview, media: vscode.Uri, scriptUri: vscode.Uri): string {
	const nonce = randomBytes(18).toString('base64');
	const script = webview.asWebviewUri(scriptUri);
	const style = webview.asWebviewUri(vscode.Uri.joinPath(media, 'editor.css'));
	const label = (value: string): string => escape(vscode.l10n.t(value));
	return `<!doctype html>
<html lang="${escape(vscode.env.language)}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src 'none'; connect-src 'none'; font-src 'none';">
<link rel="stylesheet" href="${style}"><title>${label('Document')}</title></head>
<body>
<header><div class="heading"><span class="eyebrow">${label('Document')}</span><strong id="name"></strong></div>
<div class="actions" aria-label="${label('Document Actions')}">
<button id="save" data-action="save" disabled>${label('Save')}</button>
<button data-action="undo" disabled>${label('Undo')}</button><button data-action="redo" disabled>${label('Redo')}</button>
<button data-action="textEditor" disabled>${label('Text Editor')}</button>
<button class="primary" id="export" data-action="export" disabled>${label('Export PDF')}</button></div></header>
<section class="settings" aria-label="${label('Page Settings')}">
<span class="paper-size">A4</span>
<label>${label('Font')}<select id="font"><option value="serif">${label('Serif')}</option><option value="sans-serif">${label('Sans Serif')}</option><option value="monospace">${label('Monospace')}</option></select></label>
<label>${label('Size (pt)')}<input id="fontSize" type="number" min="10" max="24" step="1" value="12"></label>
<label>${label('Line Spacing')}<input id="lineHeight" type="number" min="1" max="2" step="0.1" value="1.5"></label>
<label>${label('Margins (mm)')}<input id="margin" type="number" min="10" max="30" step="1" value="20"></label>
<span id="pageHelp">${label('Approximate page preview. PDF pagination may differ.')}</span>
</section>
<div id="conflict" role="alert" hidden><p>${label('The file changed while you were typing. Your draft is kept below. Choose which version to use.')}</p>
<button id="useFile">${label('Use File Version')}</button><button id="keepDraft">${label('Keep My Draft')}</button></div>
<section class="find" aria-label="${label('Find in Document')}"><label for="query">${label('Find')}</label><input id="query" type="search"><button id="findNext">${label('Next Match')}</button></section>
<div class="document-status">
<span id="sync" role="status" aria-live="polite" data-saved="${label('Saved')}" data-dirty="${label('Unsaved Changes')}" data-pending="${label('Updating…')}" data-conflict="${label('Draft Needs Review')}">${label('Opening…')}</span>
<div id="document-counts">
<span>${label('Words:')} <span id="word-count">0</span></span>
<span>${label('Characters with spaces:')} <span id="character-count">0</span></span>
</div>
</div>
<main><div class="sheet"><textarea id="text" aria-label="${label('Document Text')}" aria-describedby="pageHelp" spellcheck="true" disabled></textarea></div></main>
<footer><span>${label('Plain text · Page settings are kept only in this editor')}</span></footer>
<div id="notice" role="status" aria-live="polite"></div>
<script nonce="${nonce}" src="${script}"></script></body></html>`;
}
