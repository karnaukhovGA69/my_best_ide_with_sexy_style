/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from 'node:path';
import * as vscode from 'vscode';
import { PackageBusyError, PackageStore, type InstalledPackage } from './store';

const viewId = 'myself.languageServers.packages';

class PackageItem extends vscode.TreeItem {
	constructor(readonly installed: InstalledPackage) {
		super(basename(installed.entryRelative));
		this.id = installed.id;
		this.description = vscode.l10n.t('Imported');
		this.tooltip = installed.entryRelative + '\nSHA-256 ' + installed.archiveSha256;
		this.contextValue = 'managedLanguageServerPackage';
		this.iconPath = new vscode.ThemeIcon('package');
	}
}

export function activate(context: vscode.ExtensionContext): void {
	if (context.globalStorageUri.scheme !== 'file' || context.globalStorageUri.authority) {
		return;
	}
	const output = vscode.window.createOutputChannel('Language Server Packages', { log: true });
	const store = new PackageStore(context.globalStorageUri.fsPath, error => output.error(String(error)));
	const changes = new vscode.EventEmitter<void>();
	const tree = vscode.window.createTreeView<PackageItem>(viewId, {
		treeDataProvider: {
			onDidChangeTreeData: changes.event,
			async getChildren() {
				return (await store.list()).map(installed => new PackageItem(installed));
			},
			getTreeItem: item => item,
		},
	});
	tree.description = vscode.l10n.t('Shared across profiles');
	context.subscriptions.push(tree, changes, output,
		vscode.commands.registerCommand('myself.languageServers.refresh', async () => {
			try {
				await store.cleanup();
			} catch (error) {
				output.error(String(error));
				void vscode.window.showErrorMessage(vscode.l10n.t('Package cleanup is incomplete. Refresh the list to retry.'));
			} finally {
				changes.fire();
			}
		}),
		vscode.commands.registerCommand('myself.languageServers.importZip', async () => {
			const selection = await vscode.window.showOpenDialog({
				canSelectMany: false,
				filters: { ZIP: ['zip'] },
				openLabel: vscode.l10n.t('Inspect ZIP'),
			});
			const source = selection?.[0];
			if (!source) {
				return;
			}
			if (source.scheme !== 'file' || source.authority) {
				void vscode.window.showErrorMessage(vscode.l10n.t('Select a ZIP on this computer.'));
				return;
			}
			const controller = new AbortController();
			try {
				const installed = await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: vscode.l10n.t('Inspecting Language Server ZIP'),
					cancellable: true,
				}, async (_progress, token) => {
					const cancellation = token.onCancellationRequested(() => controller.abort());
					if (token.isCancellationRequested) {
						controller.abort();
					}
					try {
						return await store.importZip(source.fsPath, async preview => {
							const selected = await vscode.window.showQuickPick(preview.entrypoints, {
								title: vscode.l10n.t('Select a macOS ARM64 Executable'),
								placeHolder: vscode.l10n.t('Publisher unverified. ZIP SHA-256 {0}', preview.archiveSha256),
							}, token);
							return selected;
						}, controller.signal);
					} finally {
						cancellation.dispose();
					}
				});
				if (installed) {
					changes.fire();
					void vscode.window.showInformationMessage(vscode.l10n.t('Language server package imported.'));
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					void vscode.window.showErrorMessage(vscode.l10n.t('Could not import the language server ZIP. {0}', (error as Error).message));
				}
			}
		}),
		vscode.commands.registerCommand('myself.languageServers.remove', async (item?: PackageItem) => {
			if (!(item instanceof PackageItem)) {
				return;
			}
			const remove = vscode.l10n.t('Remove');
			const confirmed = await vscode.window.showWarningMessage(
				vscode.l10n.t('Remove {0} from the shared language server library?', basename(item.installed.entryRelative)),
				{ modal: true, detail: vscode.l10n.t('This removes the installed copy for all IDE profiles.') },
				remove,
			);
			if (confirmed !== remove) {
				return;
			}
			try {
				await store.remove(item.installed.id);
			} catch (error) {
				if (error instanceof PackageBusyError) {
					void vscode.window.showInformationMessage(vscode.l10n.t('This package is busy. Try removing it after the other operation finishes.'));
					return;
				}
				const retry = vscode.l10n.t('Retry Cleanup');
				if (await vscode.window.showErrorMessage(vscode.l10n.t('Could not remove the package. {0}', (error as Error).message), retry) === retry) {
					try {
						await store.remove(item.installed.id);
					} catch (retryError) {
						void vscode.window.showErrorMessage(vscode.l10n.t('Could not finish removing the package. {0}', (retryError as Error).message));
					}
				}
			} finally {
				changes.fire();
			}
		}),
	);
}
