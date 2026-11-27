/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { getWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { SavedPanelLayoutProfileTracker } from './savedPanelLayoutProfiles.js';
import { SavedPanelLayoutsController } from './savedPanelLayoutsController.js';

const savedPanelLayoutsMenu = new MenuId('MyselfSavedPanelLayouts');

class SavedPanelLayoutsContribution extends Disposable {
	constructor(
		@IWorkbenchLayoutService layout: IWorkbenchLayoutService,
		@IViewsService views: IViewsService,
		@IViewDescriptorService descriptors: IViewDescriptorService,
		@IPaneCompositePartService paneComposites: IPaneCompositePartService,
		@IStorageService storage: IStorageService,
		@IQuickInputService quickInput: IQuickInputService,
		@IDialogService dialogs: IDialogService,
		@INotificationService notifications: INotificationService,
		@IWorkspaceTrustManagementService trust: IWorkspaceTrustManagementService,
		@ILifecycleService lifecycle: ILifecycleService,
	) {
		super();
		const profiles = getWorkbenchContribution<SavedPanelLayoutProfileTracker>(SavedPanelLayoutProfileTracker.ID);
		const controller = this._register(new SavedPanelLayoutsController(layout, views, descriptors, paneComposites, profiles, storage, quickInput, dialogs, notifications, trust));
		this._register(MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
			submenu: savedPanelLayoutsMenu,
			title: localize2('savedPanelLayoutsMenu', "Panel Layouts"),
			group: '2_appearance',
			order: 3,
		}));
		for (const [index, spec] of ([
			{ action: 'save', title: localize2('savePanelLayout', "Save Current Panel Layout…") },
			{ action: 'apply', title: localize2('applyPanelLayout', "Apply Saved Panel Layout…") },
			{ action: 'delete', title: localize2('deleteSavedPanelLayout', "Delete Saved Panel Layout…") },
		] as const).entries()) {
			this._register(registerAction2(class extends Action2 {
				constructor() {
					super({
						id: `myself.panelLayouts.${spec.action}`,
						title: spec.title,
						f1: false,
						menu: { id: savedPanelLayoutsMenu, order: index + 1 },
					});
				}

				override run(): Promise<void> {
					return controller.run(spec.action);
				}
			}));
		}
		this._register(lifecycle.onWillShutdown(() => this.dispose()));
	}
}

registerWorkbenchContribution2(SavedPanelLayoutProfileTracker.ID, SavedPanelLayoutProfileTracker, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2('workbench.contrib.myselfSavedPanelLayouts', SavedPanelLayoutsContribution, WorkbenchPhase.AfterRestored);
