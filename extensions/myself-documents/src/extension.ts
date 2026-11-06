/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { defaultPage, exportCommand, exportDocument, isPageOptions, isRecord, normalizeText, textChange } from './document';
import { editorHtml } from './view';
import { registerLibrary } from './library';

const viewType = 'myself.documents.editor';

export function activate(context: vscode.ExtensionContext): void {
	registerLibrary(context);
	context.subscriptions.push(vscode.window.registerCustomEditorProvider(viewType, new DocumentEditor(context.extensionUri), {
		webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false
	}));
	context.subscriptions.push(vscode.commands.registerCommand('myself.documents.new', async () => {
		const document = await vscode.workspace.openTextDocument({ language: 'plaintext', content: '' });
		await vscode.commands.executeCommand('vscode.openWith', document.uri, viewType);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('myself.documents.open', async (uri?: vscode.Uri) => {
		uri ??= vscode.window.activeTextEditor?.document.uri;
		if (!uri || !uri.path.toLowerCase().endsWith('.txt')) {
			await vscode.window.showInformationMessage(vscode.l10n.t('Choose a .txt file to open as a document.'));
			return;
		}
		await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
	}));
}

class DocumentEditor implements vscode.CustomTextEditorProvider {
	constructor(private readonly extensionUri: vscode.Uri) { }

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		const media = vscode.Uri.joinPath(this.extensionUri, 'media');
		const scripts = vscode.Uri.joinPath(this.extensionUri, 'out', 'webview');
		panel.webview.options = { enableScripts: true, localResourceRoots: [media, scripts] };
		panel.webview.html = editorHtml(panel.webview, media, vscode.Uri.joinPath(scripts, 'editor.js'));
		let disposed = false;
		let applying = false;
		let queue = Promise.resolve();
		const post = (message: object): void => { if (!disposed) { void panel.webview.postMessage(message); } };
		const snapshot = (extra: object = {}): void => post({
			type: 'snapshot', text: normalizeText(document.getText()), version: document.version,
			dirty: document.isDirty, name: document.uri.path.split('/').pop() || vscode.l10n.t('Untitled Document'), ...extra
		});
		const subscriptions: vscode.Disposable[] = [];
		subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document === document && !applying) {
				snapshot();
			}
		}));
		subscriptions.push(vscode.workspace.onDidSaveTextDocument(saved => {
			if (saved === document) {
				snapshot();
			}
		}));
		subscriptions.push(panel.webview.onDidReceiveMessage((message: unknown) => {
			queue = queue.then(async () => {
				if (disposed || !isRecord(message)) {
					return;
				}
				if (message.type === 'ready') {
					snapshot({ initial: true, page: defaultPage });
					return;
				}
				if (message.type === 'edit' && typeof message.text === 'string' && typeof message.id === 'number') {
					if (message.version !== document.version) {
						snapshot({ ack: message.id, conflict: true });
						return;
					}
					const change = textChange(document.getText(), message.text, document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
					let accepted = true;
					applying = true;
					try {
						if (change) {
							const edit = new vscode.WorkspaceEdit();
							edit.replace(document.uri, new vscode.Range(document.positionAt(change.start), document.positionAt(change.end)), change.text);
							accepted = await vscode.workspace.applyEdit(edit);
						}
					} finally {
						applying = false;
					}
					snapshot({ ack: message.id, conflict: !accepted || normalizeText(document.getText()) !== normalizeText(message.text) });
					return;
				}
				if (message.type === 'action') {
					if (message.version !== document.version) {
						snapshot({ conflict: true });
						post({ type: 'actionDone' });
						return;
					}
					try {
						switch (message.action) {
							case 'save': {
								// workspace.save handles Save As for untitled custom editors.
								const saved = await vscode.workspace.save(document.uri);
								// Save As replaces the untitled editor with a text editor. Replace that
								// editor in place instead of opening a second tab for the same file.
								if (saved && saved.toString() !== document.uri.toString()) {
									await vscode.commands.executeCommand('reopenActiveEditorWith', viewType, saved);
								}
								break;
							}
							case 'undo':
							case 'redo':
								await vscode.commands.executeCommand(message.action);
								break;
							case 'textEditor':
								await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
								break;
							case 'export': {
								if (!isPageOptions(message.page)) {
									throw new Error('invalid-page');
								}
								const result = await exportDocument({
									getCommands: () => vscode.commands.getCommands(true),
									execute: request => vscode.commands.executeCommand(exportCommand, request)
								}, document.getText(), (document.uri.path.split('/').pop() || 'Document').replace(/\.txt$/i, '') + '.pdf', message.page);
								post({ type: 'notice', text: result.status === 'saved' ? vscode.l10n.t('PDF saved.') : vscode.l10n.t('Export cancelled.') });
								break;
							}
						}
					} finally {
						post({ type: 'actionDone' });
					}
				}
			}).catch((error: unknown) => {
				const code = error instanceof Error ? error.message : '';
				const text = code === 'missing-backend' ? vscode.l10n.t('PDF export is not available in this build. Your text is unchanged.')
					: code === 'too-large' ? vscode.l10n.t('PDF export supports up to 2 MiB of text. Save your text or export a shorter document.')
						: vscode.l10n.t('The operation could not be completed. Your text is still available; try again or use the text editor.');
				post({ type: 'notice', text });
				if (isRecord(message) && message.type === 'edit') {
					snapshot({ ack: message.id, conflict: true });
				}
				post({ type: 'actionDone' });
			});
		}));
		panel.onDidDispose(() => {
			disposed = true;
			for (const subscription of subscriptions) {
				subscription.dispose();
			}
		});
	}
}
