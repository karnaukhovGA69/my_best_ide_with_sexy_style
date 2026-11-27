/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { maxSchemaRows, renderSchema } from './schema.js';
import { isLiteralAbsolutePath, isLiteralIdentifier, isPort, SchemaError, type LocalTarget, type SchemaErrorCode } from './target.js';
import { inspectConfirmedSchema } from './workflow.js';

function isLocal(uri: vscode.Uri): boolean {
	return uri.scheme === 'file' && !uri.authority && !uri.query && !uri.fragment && isLiteralAbsolutePath(uri.path);
}

function describeError(code: SchemaErrorCode): string {
	switch (code) {
		case 'target':
			return vscode.l10n.t('Choose an executable psql file and a Unix socket directory with an existing PostgreSQL socket. The binary and directory must have group and other write bits clear.');
		case 'target-changed':
			return vscode.l10n.t('The selected executable or socket changed. Open the command again to review the target.');
		case 'launch':
			return vscode.l10n.t('Could not start the selected psql executable.');
		case 'timeout':
			return vscode.l10n.t('The PostgreSQL schema request timed out.');
		case 'output-limit':
			return vscode.l10n.t('The PostgreSQL schema response exceeded the output limit.');
		case 'credentials':
			return vscode.l10n.t('The server requested authentication. The schema viewer supports local connections that already work without client credentials.');
		case 'client-version':
			return vscode.l10n.t('Choose a psql build whose PostgreSQL client library supports require_auth.');
		case 'connection':
			return vscode.l10n.t('Could not connect to the selected Unix socket or read the schema.');
		case 'invalid-result':
			return vscode.l10n.t('The psql result did not match the expected schema format.');
	}
}

async function pickTarget(isCurrent: () => boolean): Promise<LocalTarget | undefined> {
	const binaries = await vscode.window.showOpenDialog({
		title: vscode.l10n.t('Choose Installed psql'),
		canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
	});
	if (!isCurrent() || binaries?.length !== 1 || !isLocal(binaries[0])) {
		return undefined;
	}
	const directories = await vscode.window.showOpenDialog({
		title: vscode.l10n.t('Choose the PostgreSQL Unix Socket Directory'),
		canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
	});
	if (!isCurrent() || directories?.length !== 1 || !isLocal(directories[0])) {
		return undefined;
	}
	const validateName = (value: string) => isLiteralIdentifier(value) ? undefined
		: vscode.l10n.t('Use 1–63 ASCII letters, digits, underscores, or dollar signs, starting with a letter or underscore.');
	const database = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Database name'), validateInput: validateName });
	if (!isCurrent() || database === undefined || !isLiteralIdentifier(database)) {
		return undefined;
	}
	const role = await vscode.window.showInputBox({ prompt: vscode.l10n.t('PostgreSQL role'), validateInput: validateName });
	if (!isCurrent() || role === undefined || !isLiteralIdentifier(role)) {
		return undefined;
	}
	const validPortText = (value: string) => /^\d{1,5}$/.test(value) && isPort(Number(value));
	const port = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('Port used in the Unix socket file name'),
		value: '5432',
		validateInput: value => validPortText(value) ? undefined : vscode.l10n.t('Enter a port from 1 to 65535.'),
	});
	if (!isCurrent() || port === undefined || !validPortText(port)) {
		return undefined;
	}
	return {
		executable: binaries[0].fsPath, socketDirectory: directories[0].fsPath, database, role, port: Number(port),
	};
}

async function confirmTarget(target: LocalTarget): Promise<boolean> {
	const approve = vscode.l10n.t('Read Schema');
	const detail = [
		vscode.l10n.t('External psql — {0}', target.executable),
		vscode.l10n.t('Unix socket — {0}/.s.PGSQL.{1}', target.socketDirectory.replace(/\/$/, ''), target.port),
		vscode.l10n.t('Database — {0}', target.database),
		vscode.l10n.t('Role — {0}', target.role),
		vscode.l10n.t('Nerded Code will start this psql executable to read schema metadata in a read-only transaction.'),
	].join('\n');
	return await vscode.window.showWarningMessage(vscode.l10n.t('Read Local PostgreSQL Schema?'), { modal: true, detail }, approve) === approve;
}

export function activate(context: vscode.ExtensionContext): void {
	let active: AbortController | undefined;
	let panel: vscode.WebviewPanel | undefined;
	const cancel = () => active?.abort();
	context.subscriptions.push(
		{ dispose: () => { cancel(); panel?.dispose(); } },
		vscode.window.onDidChangeActiveTextEditor(cancel),
		vscode.workspace.onDidChangeWorkspaceFolders(() => { cancel(); panel?.dispose(); }),
		vscode.commands.registerCommand('myself.postgresqlSchema.open', async () => {
			if (active) {
				return;
			}
			const document = vscode.window.activeTextEditor?.document;
			const folder = document && vscode.workspace.getWorkspaceFolder(document.uri);
			const permitted = () => vscode.workspace.isTrusted && !vscode.env.remoteName && (process.platform === 'darwin' || process.platform === 'linux');
			if (!permitted() || document?.languageId !== 'sql' || !folder || !isLocal(document.uri) || !isLocal(folder.uri)) {
				void vscode.window.showInformationMessage(vscode.l10n.t('Open a local SQL file in a trusted folder on macOS or Linux to view a PostgreSQL schema.'));
				return;
			}
			const request = new AbortController();
			active = request;
			const isCurrent = () => !request.signal.aborted && permitted()
				&& vscode.window.activeTextEditor?.document === document && document.languageId === 'sql'
				&& vscode.workspace.getWorkspaceFolder(document.uri)?.uri.toString() === folder.uri.toString();
			try {
				const target = await pickTarget(isCurrent);
				if (!target || !isCurrent()) {
					return;
				}
				const result = await inspectConfirmedSchema(target, request.signal, { isCurrent, confirm: confirmTarget });
				if (!result || !isCurrent()) {
					return;
				}
				const title = vscode.l10n.t('PostgreSQL Schema');
				if (!panel) {
					panel = vscode.window.createWebviewPanel('myself.postgresqlSchema', title,
						{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
						{ enableScripts: false, enableCommandUris: false, localResourceRoots: [] });
					const listener = panel.onDidDispose(() => { listener.dispose(); panel = undefined; });
				} else {
					panel.reveal(panel.viewColumn, true);
				}
				panel.webview.html = renderSchema(result, {
					title,
					database: vscode.l10n.t('Database {0} · Role {1}', target.database, target.role),
					headings: [vscode.l10n.t('Schema'), vscode.l10n.t('Table'), vscode.l10n.t('Column'), vscode.l10n.t('Type')],
					empty: vscode.l10n.t('This role can see no columns in the selected database schemas.'),
					truncated: vscode.l10n.t('Showing the first {0} columns.', maxSchemaRows),
				});
			} catch (error) {
				if (isCurrent()) {
					void vscode.window.showErrorMessage(describeError(error instanceof SchemaError ? error.code : 'connection'));
				}
			} finally {
				active = undefined;
			}
		}),
	);
}
