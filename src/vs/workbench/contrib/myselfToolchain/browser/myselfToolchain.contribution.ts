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
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { RemoteNameContext, WorkspaceFolderCountContext } from '../../../common/contextkeys.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { VIEW_ID } from '../../files/common/files.js';
import { WorkspaceTrustContext } from '../../workspace/common/workspace.js';
import { PythonInterpreterPicker } from './pythonInterpreterPicker.js';

/** Expose the picker alongside Check Project and ignore caller-supplied paths or targets. */
export function registerPythonInterpreterPickerAction(picker: Pick<PythonInterpreterPicker, 'run'>): IDisposable {
	return registerAction2(class extends Action2 {
		constructor() {
			super({
				id: 'myself.project.setDefaultPythonInterpreter',
				title: localize2('pickProjectPythonInterpreter', "Configure Project Python Interpreter…"),
				icon: Codicon.settingsGear,
				precondition: ContextKeyExpr.and(WorkspaceTrustContext.IsTrusted, RemoteNameContext.isEqualTo(''), WorkspaceFolderCountContext.notEqualsTo(0)),
				f1: false,
				menu: [
					{ id: MenuId.MenubarTerminalMenu, group: '2_project', order: 5 },
					{ id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', VIEW_ID), group: 'navigation', order: 5 },
				],
			});
		}

		override run(): Promise<void> {
			return picker.run();
		}
	});
}

class MyselfToolchainContribution extends Disposable {
	constructor(
		@IWorkspaceContextService context: IWorkspaceContextService,
		@IWorkspaceTrustManagementService trust: IWorkspaceTrustManagementService,
		@IConfigurationService configuration: IConfigurationService,
		@IQuickInputService quickInput: IQuickInputService,
		@IFileDialogService fileDialog: IFileDialogService,
		@IFileService files: IFileService,
		@IDialogService dialogs: IDialogService,
		@INotificationService notification: INotificationService,
		@IWorkbenchEnvironmentService environment: IWorkbenchEnvironmentService,
		@ILifecycleService lifecycle: ILifecycleService,
	) {
		super();
		const picker = this._register(new PythonInterpreterPicker({
			context, trust, configuration, quickInput, fileDialog, files, dialogs, notification,
			isRemote: !!environment.remoteAuthority,
		}));
		this._register(registerPythonInterpreterPickerAction(picker));
		this._register(lifecycle.onWillShutdown(() => this.dispose()));
	}
}

registerWorkbenchContribution2('workbench.contrib.myselfToolchain', MyselfToolchainContribution, WorkbenchPhase.AfterRestored);
