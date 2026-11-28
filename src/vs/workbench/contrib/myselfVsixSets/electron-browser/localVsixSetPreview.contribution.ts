/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { inspectLocalVsixCommand, type ILocalVsixInspection } from '../../../../platform/extensionManagement/common/extensionManagementIpc.js';
import type { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ISharedProcessService } from '../../../../platform/ipc/electron-browser/services.js';
import { getWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { InstallationDiagnosticsProfileTracker } from '../../myselfDiagnostics/browser/installationDiagnosticsReader.js';
import { registerLocalVsixSetPreviewAction } from '../browser/localVsixSetPreview.contribution.js';
import type { LocalVsixInspector } from '../browser/localVsixSetMetadata.js';
import { registerLocalVsixVersionCompareAction } from '../browser/localVsixVersionCompare.contribution.js';

function createInspector(accessor: ServicesAccessor): LocalVsixInspector {
	const sharedProcess = accessor.get(ISharedProcessService);
	return (resource, maxBytes, token) => sharedProcess.getChannel('extensions')
		.call<ILocalVsixInspection | undefined>(inspectLocalVsixCommand, [resource, maxBytes], token);
}

registerLocalVsixSetPreviewAction(createInspector);

class LocalVsixVersionCompareContribution extends Disposable {
	static readonly ID = 'workbench.contrib.localVsixVersionCompare';

	constructor(
		@IExtensionService runtime: IExtensionService,
		@IWorkbenchEnvironmentService environment: IWorkbenchEnvironmentService,
	) {
		super();
		if (environment.remoteAuthority) {
			return;
		}
		const profile = getWorkbenchContribution<InstallationDiagnosticsProfileTracker>(InstallationDiagnosticsProfileTracker.ID);
		void runtime.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._register(registerLocalVsixVersionCompareAction(createInspector, profile));
			}
		}, () => { /* No command when extension registration fails. */ });
	}
}

registerWorkbenchContribution2(LocalVsixVersionCompareContribution.ID, LocalVsixVersionCompareContribution, WorkbenchPhase.AfterRestored);
