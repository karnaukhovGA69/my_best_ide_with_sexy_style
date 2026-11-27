/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ByteSize } from '../../../../platform/files/common/files.js';
import { getWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { InstallationDiagnosticsProfileTracker } from '../../myselfDiagnostics/browser/installationDiagnosticsReader.js';
import { readExtensionResources } from './extensionResourceDiagnostics.js';

class ExtensionResourceDiagnosticsContribution extends Disposable {
	static readonly ID = 'workbench.contrib.extensionResourceDiagnostics';

	constructor(
		@IExtensionsWorkbenchService extensions: IExtensionsWorkbenchService,
		@IExtensionService runtime: IExtensionService,
		@IDialogService dialogs: IDialogService,
		@IWorkbenchEnvironmentService environment: IWorkbenchEnvironmentService,
	) {
		super();
		if (environment.remoteAuthority) {
			return;
		}

		const profile = getWorkbenchContribution<InstallationDiagnosticsProfileTracker>(InstallationDiagnosticsProfileTracker.ID);
		// Wait for standard extension registration before exposing the command to the dispatcher.
		void runtime.whenInstalledExtensionsRegistered().then(() => {
			if (this._store.isDisposed) {
				return;
			}
			const isDisposed = () => this._store.isDisposed;
			this._register(registerAction2(class CheckExtensionSizesAction extends Action2 {
				constructor() {
					super({
						id: 'myself.diagnostics.checkExtensionSizes',
						title: localize2('checkExtensionSizes', "Check Extension Sizes"),
						menu: { id: MenuId.MenubarHelpMenu, group: '2_reference', order: 10 },
					});
				}

				override async run(): Promise<void> {
					const snapshot = await readExtensionResources(profile, extensions);
					if (isDisposed()) {
						return;
					}

					const title = localize('extensionResourcesTitle', "Extension Resources");
					if (!snapshot || snapshot.revision !== profile.revision || profile.inventoryStatus !== 'available') {
						await dialogs.info(title, localize('inventoryUnavailable', "The extension list for the active profile is unavailable. Try again when the profile finishes loading, or reopen the window."));
						return;
					}
					const detail = [
						localize('currentProfile', "Active profile: {0}", snapshot.profileName),
						'',
						localize('diskSizeExplanation', "Disk sizes use the stored logical size of each installed extension. The amount of space freed on uninstall depends on the files and profiles that still use them."),
						localize('ramExplanation', "Extensions can share a host process, so RAM use for each extension is unknown. For process-level usage, choose Help → Open Process Explorer."),
						'',
					];
					if (!snapshot.entries.length) {
						detail.push(localize('emptyLocalInventory', "There are no local extensions in the active profile's list."));
					}
					for (const { id, size, builtIn } of snapshot.entries) {
						const displaySize = size === undefined ? localize('unknownDiskSize', "Unknown") : ByteSize.formatSize(size);
						detail.push(builtIn
							? localize('builtInSize', "{0} (built-in) · {1}", id, displaySize)
							: localize('installedSize', "{0} · {1}", id, displaySize));
					}
					await dialogs.prompt({ type: 'info', custom: true, message: title, detail: detail.join('\n') });
				}
			}));
		}, () => { /* No command when extension registration fails. */ });
	}
}

registerWorkbenchContribution2(ExtensionResourceDiagnosticsContribution.ID, ExtensionResourceDiagnosticsContribution, WorkbenchPhase.AfterRestored);
