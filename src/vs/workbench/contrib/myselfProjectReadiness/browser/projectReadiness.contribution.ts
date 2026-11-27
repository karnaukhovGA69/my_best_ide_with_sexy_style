/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, type IDisposable } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { VIEW_ID } from '../../files/common/files.js';
import { ProjectReadinessDialog } from './projectReadinessDialog.js';

/** Register the visible action alongside the existing Tasks shortcuts. */
export function registerProjectReadinessAction(dialog: Pick<ProjectReadinessDialog, 'run'>): IDisposable {
	return registerAction2(class extends Action2 {
		constructor() {
			super({
				id: 'myself.project.checkReadiness',
				title: localize2('checkProject', "Check Project"),
				icon: Codicon.checkAll,
				f1: false,
				menu: [
					{ id: MenuId.MenubarTerminalMenu, group: '2_project', order: 4 },
					{ id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', VIEW_ID), group: 'navigation', order: 4 },
				],
			});
		}

		override run(): Promise<void> {
			return dialog.run();
		}
	});
}

class ProjectReadinessContribution extends Disposable {
	constructor(
		@IWorkspaceContextService context: IWorkspaceContextService,
		@IWorkspaceTrustManagementService trust: IWorkspaceTrustManagementService,
		@IConfigurationService configuration: IConfigurationService,
		@IFileService files: IFileService,
		@IDialogService dialogs: IDialogService,
		@ILifecycleService lifecycleService: ILifecycleService,
	) {
		super();
		const dialog = this._register(new ProjectReadinessDialog(context, trust, configuration, files, dialogs));
		this._register(registerProjectReadinessAction(dialog));
		this._register(lifecycleService.onWillShutdown(() => this.dispose()));
	}
}

// Register from the desktop entrypoint, where file: is the native disk provider.
registerWorkbenchContribution2('workbench.contrib.myselfProjectReadiness', ProjectReadinessContribution, WorkbenchPhase.AfterRestored);
