/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PdfInputError, readLocalPdf } = require('./local-pdf.cjs');
const { createPreviewHtml } = require('./view.cjs');

const commandId = 'myself.localPdfViewer.open';
const viewType = 'myself.localPdfViewer.canvas';

function messages(t) {
	return {
		title: t('Local PDF Preview'),
		previous: t('Previous Page'),
		next: t('Next Page'),
		position: t('Page {0} of {1}', '{page}', '{count}'),
		canvas: t('Rendered PDF page'),
		coverage: t('Limited preview for PDFs with supported content and embedded resources. Up to 16 MiB and 200 pages.'),
		loading: t('Rendering page…'),
		resource: t('This page needs a font, character map, or another resource outside the supported preview.'),
		limit: t('This PDF or page exceeds the preview limits.'),
		password: t('Password-protected PDFs are unavailable in this preview.'),
		timeout: t('Rendering took too long.'),
		unsupported: t('This page could not be rendered by the limited PDF preview.'),
		worker: t('The local PDF renderer could not start.'),
	};
}

function describeInputError(t, reason) {
	switch (reason) {
		case 'local': return t('Choose a regular local PDF file.');
		case 'size': return t('Choose a PDF of 16 MiB or less.');
		case 'changed': return t('The PDF changed while it was being read. Choose it again.');
		case 'format': return t('The selected file does not start with a PDF header.');
		default: return t('The selected local PDF could not be read.');
	}
}

async function loadAssets() {
	const [source, worker, lock] = await Promise.all([
		fs.readFile(path.join(__dirname, 'preview.js'), 'utf8'),
		fs.readFile(path.join(__dirname, 'worker.mjs')),
		fs.readFile(path.join(__dirname, 'engine.json'), 'utf8'),
	]);
	if (createHash('sha256').update(worker).digest('hex') !== JSON.parse(lock).workerSha256) {
		throw new Error('Packaged PDF renderer digest mismatch');
	}
	return { source, worker };
}

/** Register a visible, argument-free action. The picker supplies the only input URI. */
function registerPreview(vscode, context) {
	const t = vscode.l10n.t;
	const text = messages(t);
	let activePanel;
	let opening = false;
	let disposed = false;

	context.subscriptions.push({ dispose() { disposed = true; activePanel?.dispose(); } });
	context.subscriptions.push(vscode.commands.registerCommand(commandId, async () => {
		if (opening || disposed) {
			return;
		}
		opening = true;
		try {
			const selected = await vscode.window.showOpenDialog({
				title: t('Open Local PDF Preview'),
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: { PDF: ['pdf'] },
			});
			if (disposed || !selected?.length) {
				return;
			}
			let bytes;
			try {
				bytes = await readLocalPdf(selected[0]);
			} catch (error) {
				void vscode.window.showWarningMessage(describeInputError(t, error instanceof PdfInputError ? error.reason : undefined));
				return;
			}
			const { source, worker } = await loadAssets();
			if (disposed) {
				return;
			}
			activePanel?.dispose();
			const { token, html } = createPreviewHtml(source, text, vscode.env.language);
			const panel = vscode.window.createWebviewPanel(viewType, text.title, vscode.ViewColumn.Beside, {
				enableScripts: true,
				enableCommandUris: false,
				enableFindWidget: false,
				localResourceRoots: [],
				retainContextWhenHidden: false,
			});
			activePanel = panel;
			const messages = panel.webview.onDidReceiveMessage(message => {
				if (activePanel !== panel || message?.kind !== 'ready' || message.token !== token) {
					return;
				}
				// Slice the exact worker bytes. Never send backing-buffer padding or a file path.
				const engine = worker.buffer.slice(worker.byteOffset, worker.byteOffset + worker.byteLength);
				void panel.webview.postMessage({ kind: 'document', token, bytes, engine }).then(undefined, () => {});
			});
			panel.onDidDispose(() => {
				messages.dispose();
				if (activePanel === panel) {
					activePanel = undefined;
				}
			});
			panel.webview.html = html;
		} catch {
			void vscode.window.showErrorMessage(t('The packaged local PDF renderer is unavailable.'));
		} finally {
			opening = false;
		}
	}));
}

function activate(context) {
	registerPreview(require('vscode'), context);
}

module.exports = { activate, registerPreview };
