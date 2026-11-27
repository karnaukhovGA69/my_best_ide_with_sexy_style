/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getPreviewFormat, maxCsvColumns, maxCsvRows, maxInputBytes, maxJsonDepth, maxJsonValues, parsePreview, PreviewError, PreviewErrorCode } from './model';
import { renderPreview } from './view';

function describeError(code: PreviewErrorCode): string {
	switch (code) {
		case 'input-size':
			return vscode.l10n.t('Data Preview supports input up to 1 MiB.');
		case 'output-size':
			return vscode.l10n.t('The preview exceeds 512 KiB after formatting. Open a smaller file to preview it.');
		case 'invalid-json':
			return vscode.l10n.t('Data Preview could not read this file as strict JSON.');
		case 'invalid-csv':
			return vscode.l10n.t('Data Preview could not read this file as comma-separated CSV. Check the quoted fields.');
		case 'csv-rows':
			return vscode.l10n.t('CSV previews support up to {0} rows.', maxCsvRows);
		case 'csv-columns':
			return vscode.l10n.t('CSV previews support up to {0} columns per row.', maxCsvColumns);
		case 'json-depth':
			return vscode.l10n.t('JSON previews support up to {0} nested object or array levels.', maxJsonDepth);
		case 'json-values':
			return vscode.l10n.t('JSON previews support up to {0} values, including containers.', maxJsonValues);
	}
}

export function activate(context: vscode.ExtensionContext): void {
	let panel: vscode.WebviewPanel | undefined;
	let panelListener: vscode.Disposable | undefined;

	function clearPanel(): void {
		panelListener?.dispose();
		panelListener = undefined;
		panel = undefined;
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('myself.dataPreview.open', () => {
			const document = vscode.window.activeTextEditor?.document;
			const uri = document?.uri;
			const format = uri && getPreviewFormat(uri.scheme, uri.authority, uri.path);
			if (!document || !uri || !format) {
				void vscode.window.showInformationMessage(vscode.l10n.t('Open a local .json or .csv file in a text editor to preview it.'));
				return;
			}

			try {
				// offsetAt clamps this position to the end of the editor buffer.
				if (document.offsetAt(new vscode.Position(document.lineCount, 0)) > maxInputBytes) {
					throw new PreviewError('input-size');
				}
				const data = parsePreview(format, document.getText());
				const name = uri.path.slice(uri.path.lastIndexOf('/') + 1).replaceAll(/\s+|\p{Bidi_Control}/gu, ' ').trim();
				const title = vscode.l10n.t('Data Preview: {0}', name);
				const html = renderPreview(data, {
					title,
					language: vscode.env.language,
					snapshot: vscode.l10n.t('Snapshot of the editor. Open Data Preview again to refresh.'),
					array: vscode.l10n.t('Array'),
					object: vscode.l10n.t('Object'),
					row: vscode.l10n.t('Row'),
					emptyCsv: vscode.l10n.t('The CSV document is empty.'),
				});

				if (!panel) {
					panel = vscode.window.createWebviewPanel('myself.dataPreview', title,
						{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
						{ enableScripts: false, enableCommandUris: false, localResourceRoots: [] });
					panelListener = panel.onDidDispose(clearPanel);
				} else {
					panel.title = title;
					panel.reveal(panel.viewColumn, true);
				}
				panel.webview.html = html;
			} catch (error) {
				const message = error instanceof PreviewError
					? describeError(error.code)
					: vscode.l10n.t('The data preview could not be opened.');
				void vscode.window.showErrorMessage(message);
			}
		}),
		{ dispose: () => { panel?.dispose(); clearPanel(); } },
	);
}
