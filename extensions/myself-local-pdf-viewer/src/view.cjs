/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const { randomBytes } = require('node:crypto');

function escapeText(text) {
	return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

/** Embed only installed, trusted UI code and localizable text. PDF bytes arrive by IPC. */
function createPreviewHtml(source, text, language) {
	if (/<\/script/i.test(source)) {
		throw new Error('Unexpected script close in packaged UI');
	}
	const nonce = randomBytes(24).toString('base64url');
	const label = key => escapeText(text[key]);
	const messages = Object.entries(text).map(([key, value]) => `data-${key}="${escapeText(value)}"`).join(' ');
	return {
		token: nonce,
		html: `<!doctype html>
<html lang="${escapeText(language)}">
<head>
	<meta charset="utf-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; worker-src blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${label('title')}</title>
	<style nonce="${nonce}">
		body { color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family, sans-serif); margin: 0; }
		header { position: sticky; top: 0; padding: 12px 16px; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-panel-border); }
		nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
		button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 10px; }
		button:hover:enabled { background: var(--vscode-button-hoverBackground); }
		button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
		button:disabled { opacity: .55; }
		p { margin: 8px 0 0; }
		main { display: grid; justify-items: center; padding: 16px; }
		canvas { background: white; max-width: 100%; height: auto; }
	</style>
</head>
<body ${messages}>
	<header>
		<nav aria-label="${label('title')}">
			<button id="previous" type="button" disabled>${label('previous')}</button>
			<button id="next" type="button" disabled>${label('next')}</button>
			<span id="position"></span>
		</nav>
		<p>${label('coverage')}</p>
		<p id="status" role="status" aria-live="polite">${label('loading')}</p>
	</header>
	<main><canvas id="page" width="0" height="0" role="img" aria-label="${label('canvas')}" hidden></canvas></main>
	<script nonce="${nonce}">${source}</script>
</body>
</html>`,
	};
}

module.exports = { createPreviewHtml };
