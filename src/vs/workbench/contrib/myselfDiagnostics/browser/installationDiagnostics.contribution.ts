/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { getWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { ActivationStatus, EnablementStatus, InstallationStatus, SelectedExtension } from '../common/installationDiagnostics.js';
import { InstallationDiagnosticsProfileTracker, InstallationDiagnosticsReader } from './installationDiagnosticsReader.js';

function formatExtensionName(id: SelectedExtension['id']): string {
	switch (id) {
		case 'llvm-vs-code-extensions.vscode-clangd': return 'clangd';
		case 'vscode.cpp': return localize('cppSyntax', "C/C++ Language Basics");
		case 'detachhead.basedpyright': return 'BasedPyright';
		case 'vscode.python': return localize('pythonSyntax', "Python Language Basics");
	}
}

function formatInstallation(status: InstallationStatus): string {
	switch (status) {
		case 'installed': return localize('installed', "Installed");
		case 'notListed': return localize('notListed', "Not in local extension list");
		case 'unavailable': return localize('installationUnavailable', "Installation status unavailable");
	}
}

function formatEnablement(status: EnablementStatus): string {
	switch (status) {
		case 'enabled': return localize('enabled', "Enabled");
		case 'disabled': return localize('disabled', "Disabled");
		case 'notApplicable': return localize('enablementNotApplicable', "Enablement not applicable");
		case 'unavailable': return localize('enablementUnavailable', "Enablement status unavailable");
	}
}

function formatActivation(status: ActivationStatus): string {
	switch (status) {
		case 'activated': return localize('activated', "Activated");
		case 'notActivated': return localize('notActivated', "Not activated");
		case 'notApplicable': return localize('activationNotApplicable', "Activation not applicable");
		case 'unavailable': return localize('activationUnavailable', "Activation unconfirmed");
	}
}

class InstallationDiagnosticsContribution extends Disposable {
	static readonly ID = 'workbench.contrib.installationDiagnostics';

	constructor(
		@IProductService product: IProductService,
		@IExtensionsWorkbenchService extensions: IExtensionsWorkbenchService,
		@IWorkbenchExtensionEnablementService enablement: IWorkbenchExtensionEnablementService,
		@IExtensionService runtime: IExtensionService,
		@IDialogService dialogs: IDialogService,
		@IWorkbenchEnvironmentService environment: IWorkbenchEnvironmentService,
	) {
		super();
		if (environment.remoteAuthority) {
			return;
		}
		const profile = getWorkbenchContribution<InstallationDiagnosticsProfileTracker>(InstallationDiagnosticsProfileTracker.ID);
		const reader = this._register(new InstallationDiagnosticsReader(profile, extensions, enablement, runtime));
		// Command dispatch can otherwise queue an activation event during extension registration.
		void runtime.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this.registerAction(reader, product, dialogs);
			}
		});
	}

	private registerAction(reader: InstallationDiagnosticsReader, product: IProductService, dialogs: IDialogService): void {
		this._register(registerAction2(class CheckMyInstallationAction extends Action2 {
			constructor() {
				super({
					id: 'myself.diagnostics.checkInstallation',
					title: localize2('checkMyInstallation', "Check My Installation"),
					menu: { id: MenuId.MenubarHelpMenu, group: '2_reference', order: 9 },
				});
			}

			override async run(): Promise<void> {
				const snapshot = await reader.collect();
				const detail = [
					localize('diagnosticVersion', "{0} version {1}", product.nameLong, product.version),
					localize('activeProfile', "Active profile: {0}", snapshot.profileName),
				];
				if (snapshot.inventory === 'profileChanged') {
					detail.push('', localize('profileChanged', "The active profile changed during the check. Reopen this dialog to check the current profile."));
				} else if (snapshot.inventory === 'profileUnconfirmed') {
					detail.push('', localize('inventoryProfileUnconfirmed', "The profile changed while the extension list was updating. Reopen the window to check the active profile."));
				} else if (snapshot.inventory === 'unavailable') {
					detail.push('', localize('inventoryUnavailable', "The local extension list is unavailable. If the profile is still loading, try again once it has finished. If the list stays unavailable, reopen the window."));
				} else {
					detail.push('', localize('localExtensions', "Local extensions in this profile"));
					for (const extension of snapshot.extensions) {
						detail.push(localize('extensionStatusLine', "{0} · {1} · {2} · {3}",
							formatExtensionName(extension.extension.id),
							formatInstallation(extension.installation),
							formatEnablement(extension.enablement),
							formatActivation(extension.activation),
						));
						if (extension.languageServer === 'unverified') {
							detail.push(localize('languageServerUnverified', "Language server: Not checked"));
						}
					}
				}
				await dialogs.info(localize('installationDiagnosticsTitle', "Installation Diagnostics"), detail.join('\n'));
			}
		}));
	}
}

// Observe profile changes before restoring the window without instantiating the extensions workbench service.
registerWorkbenchContribution2(InstallationDiagnosticsProfileTracker.ID, InstallationDiagnosticsProfileTracker, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(InstallationDiagnosticsContribution.ID, InstallationDiagnosticsContribution, WorkbenchPhase.AfterRestored);
