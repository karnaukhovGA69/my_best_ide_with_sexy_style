/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LocalHttpError, prepareLocalRequest } from './model';
import { LocalHttpResponse, sendLocalRequest } from './transport';
import { renderResponse } from './view';

function trustedLocalWindow(): boolean {
	return vscode.workspace.isTrusted && !vscode.env.remoteName
		&& !vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme !== 'file' || !!folder.uri.authority);
}

function errorMessage(error: unknown): string {
	switch (error instanceof LocalHttpError ? error.code : undefined) {
		case 'invalid-method':
			return vscode.l10n.t('Choose GET or POST.');
		case 'invalid-target':
			return vscode.l10n.t('Enter an HTTP or HTTPS URL using 127.0.0.1 or [::1], up to 2048 characters. Omit credentials and fragments.');
		case 'body-size':
			return vscode.l10n.t('The POST body exceeds 16 KiB of UTF-8 text.');
		case 'timeout':
			return vscode.l10n.t('The local request timed out after 10 seconds.');
		case 'https-failed':
			return vscode.l10n.t('The local HTTPS request failed. Check that the service is listening and its certificate is trusted for the selected address.');
		default:
			return vscode.l10n.t('The local HTTP request failed.');
	}
}

export function activate(context: vscode.ExtensionContext): void {
	let disposed = false;
	let busy = false;
	let controller: AbortController | undefined;
	let panel: vscode.WebviewPanel | undefined;
	let panelListener: vscode.Disposable | undefined;

	function canSend(): boolean {
		return !disposed && trustedLocalWindow();
	}

	function clearPanel(): void {
		panelListener?.dispose();
		panelListener = undefined;
		panel = undefined;
	}

	function showResponse(response: LocalHttpResponse): void {
		const title = vscode.l10n.t('Local HTTP Response');
		const html = renderResponse(title, vscode.l10n.t('HTTP status {0}', response.status), response.text,
			response.truncated ? vscode.l10n.t('Showing the first 64 KiB of response bytes.') : '', vscode.env.language);
		if (!panel) {
			panel = vscode.window.createWebviewPanel('myself.localHttp.response', title,
				{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
				{ enableScripts: false, enableCommandUris: false, localResourceRoots: [] });
			panelListener = panel.onDidDispose(clearPanel);
		} else {
			panel.reveal(panel.viewColumn, true);
		}
		panel.webview.html = html;
	}

	context.subscriptions.push(vscode.commands.registerCommand('myself.localHttp.request', async () => {
		if (busy || !canSend()) {
			return;
		}
		busy = true;
		try {
			const method = await vscode.window.showQuickPick(['GET', 'POST'] as const, { placeHolder: vscode.l10n.t('Choose a method for one local HTTP request') });
			if (!method || !canSend()) {
				return;
			}
			const url = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Enter the loopback URL to request'),
				placeHolder: 'http://127.0.0.1:3000/',
				validateInput: input => {
					try {
						prepareLocalRequest(method, input, '');
						return undefined;
					} catch (error) {
						return errorMessage(error);
					}
				},
			});
			if (url === undefined || !canSend()) {
				return;
			}
			const body = method === 'POST'
				? await vscode.window.showInputBox({ prompt: vscode.l10n.t('Enter a one-line POST body as plain text') })
				: '';
			if (body === undefined || !canSend()) {
				return;
			}
			const input = prepareLocalRequest(method, url, body);
			const send = vscode.l10n.t('Send Once');
			const detail = [
				vscode.l10n.t('The request includes {0} UTF-8 body bytes.', input.bodyBytes),
				input.target.hasQuery ? vscode.l10n.t('The query you entered will be included in this request.') : '',
			].filter(Boolean).join('\n');
			const confirmation = await vscode.window.showWarningMessage(
				vscode.l10n.t('Send one {0} request to {1}?', method, input.target.displayEndpoint),
				{ modal: true, detail }, send);
			if (confirmation !== send || !canSend()) {
				return;
			}

			const response = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('Sending local HTTP request'),
				cancellable: true,
			}, async (_progress, token) => {
				if (!canSend()) {
					return undefined;
				}
				const abort = new AbortController();
				controller = abort;
				const cancellation = token.onCancellationRequested(() => abort.abort());
				try {
					if (token.isCancellationRequested) {
						abort.abort();
					}
					return await sendLocalRequest(method, url, body, abort.signal);
				} finally {
					cancellation.dispose();
					controller = undefined;
				}
			});
			if (response && canSend()) {
				showResponse(response);
			}
		} catch (error) {
			if (!canSend()) {
				return;
			}
			if (error instanceof LocalHttpError && error.code === 'cancelled') {
				void vscode.window.showInformationMessage(vscode.l10n.t('The request was stopped. A server that already received it may still finish processing.'));
			} else {
				void vscode.window.showErrorMessage(errorMessage(error));
			}
		} finally {
			busy = false;
		}
	}), { dispose: () => {
		disposed = true;
		controller?.abort();
		panel?.dispose();
		clearPanel();
	} });
}
