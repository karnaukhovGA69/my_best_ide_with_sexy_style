/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';

export function libraryHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const nonce = randomUUID();
	const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'library.js'));
	const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'library.css'));
	const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	return `<!doctype html><html lang="${escape(vscode.env.language)}"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${style}"></head>
<body><div id="empty"><p>${escape(vscode.l10n.t('Choose an article from the library.'))}</p>
<button id="empty-back" type="button" hidden>${escape(vscode.l10n.t('Back'))}</button></div>
<main id="reader" hidden>
<header><div><h1 id="title"></h1><p id="metadata"></p></div><div class="actions"><button id="back" type="button">${escape(vscode.l10n.t('Back'))}</button><button id="source" type="button">${escape(vscode.l10n.t('Open Original in Browser'))}</button></div></header>
<form id="find" aria-label="${escape(vscode.l10n.t('Find in Document'))}"><input id="query" type="search" aria-label="${escape(vscode.l10n.t('Find in Document'))}" placeholder="${escape(vscode.l10n.t('Find in Document'))}"><button type="submit">${escape(vscode.l10n.t('Next Match'))}</button></form>
<p id="find-status" role="status" data-no-match="${escape(vscode.l10n.t('No matches found.'))}" hidden></p>
<label id="contents-label" for="contents">${escape(vscode.l10n.t('Contents'))}</label><select id="contents"></select>
<p id="notice" role="status"></p><article id="document" aria-label="${escape(vscode.l10n.t('Local documentation'))}"></article></main>
<script nonce="${nonce}" src="${script}"></script></body></html>`;
}
