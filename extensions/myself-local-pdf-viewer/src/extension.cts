/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import { PdfInputError, readLocalPdf, type LocalPdfUri, type PdfInputFailure } from './local-pdf.cjs';
import type { DocumentMessage, PreviewText, ReadyMessage } from './protocol.js';
import { createPreviewHtml } from './view.cjs';

interface PreviewPanel extends Pick<vscode.WebviewPanel, 'dispose' | 'onDidDispose'> {
	readonly webview: Pick<vscode.Webview, 'html' | 'postMessage'> & { onDidReceiveMessage: vscode.Event<unknown> };
}

type Localize = (message: string, ...args: string[]) => string;

export interface PreviewHost {
	readonly commands: { registerCommand(id: string, handler: () => Promise<void>): vscode.Disposable };
	readonly env: Pick<typeof vscode.env, 'language'>;
	readonly l10n: { t: Localize };
	readonly ViewColumn: Pick<typeof vscode.ViewColumn, 'Beside'>;
	readonly window: {
		showOpenDialog(options: vscode.OpenDialogOptions): Thenable<readonly LocalPdfUri[] | undefined>;
		showWarningMessage(message: string): Thenable<unknown>;
		showErrorMessage(message: string): Thenable<unknown>;
		createWebviewPanel(viewType: string, title: string, column: vscode.ViewColumn,
			options: vscode.WebviewPanelOptions & vscode.WebviewOptions): PreviewPanel;
	};
}

const commandId = 'myself.localPdfViewer.open';
const viewType = 'myself.localPdfViewer.canvas';

function messages(t: Localize): PreviewText {
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

function describeInputError(t: Localize, reason: PdfInputFailure | undefined) {
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
	const engineLock: { workerSha256?: string } = JSON.parse(lock);
	if (createHash('sha256').update(worker).digest('hex') !== engineLock.workerSha256) {
		throw new Error('Packaged PDF renderer digest mismatch');
	}
	return { source, worker };
}

function isReadyMessage(message: unknown): message is ReadyMessage {
	return typeof message === 'object' && message !== null &&
		'kind' in message && message.kind === 'ready' && 'token' in message && typeof message.token === 'string';
}

/** Register a visible, argument-free action. The picker supplies the only input URI. */
export function registerPreview(vscode: PreviewHost, context: Pick<vscode.ExtensionContext, 'subscriptions'>): void {
	const t = vscode.l10n.t;
	const text = messages(t);
	let activePanel: PreviewPanel | undefined;
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
			let bytes: ArrayBuffer;
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
				if (activePanel !== panel || !isReadyMessage(message) || message.token !== token) {
					return;
				}
				// Slice the exact worker bytes. Never send backing-buffer padding or a file path.
				const engine = worker.buffer.slice(worker.byteOffset, worker.byteOffset + worker.byteLength);
				const document: DocumentMessage = { kind: 'document', token, bytes, engine };
				void panel.webview.postMessage(document).then(undefined, () => {});
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

export function activate(context: vscode.ExtensionContext): void {
	const host: typeof vscode = require('vscode');
	registerPreview(host, context);
}
