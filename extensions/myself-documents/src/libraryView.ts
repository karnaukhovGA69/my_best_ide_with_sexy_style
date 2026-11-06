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
<body><header><button id="back" type="button">${escape(vscode.l10n.t('Back'))}</button><div><h1 id="title"></h1><p id="metadata"></p></div><button id="source" type="button">${escape(vscode.l10n.t('Open Original in Browser'))}</button></header>
<label id="contents-label" for="contents">${escape(vscode.l10n.t('Contents'))}</label><select id="contents"></select>
<p id="notice" role="status"></p><article id="document" aria-label="${escape(vscode.l10n.t('Local documentation'))}"></article>
<script nonce="${nonce}" src="${script}"></script></body></html>`;
}
