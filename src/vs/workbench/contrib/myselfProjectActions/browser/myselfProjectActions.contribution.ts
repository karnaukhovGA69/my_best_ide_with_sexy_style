/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { VIEW_ID } from '../../files/common/files.js';
import { TaskCommandsRegistered, TaskExecutionSupportedContext } from '../../tasks/common/taskService.js';
import { WorkspaceTrustContext } from '../../workspace/common/workspace.js';

const enabled = ContextKeyExpr.and(WorkspaceTrustContext.IsTrusted, TaskExecutionSupportedContext, TaskCommandsRegistered);

for (const [index, action] of [
	{ id: 'myself.project.runTask', title: localize2('runProjectTask', "Run Task…"), icon: Codicon.play, taskCommand: 'workbench.action.tasks.runTask' },
	{ id: 'myself.project.build', title: localize2('buildProject', "Build"), icon: Codicon.tools, taskCommand: 'workbench.action.tasks.build' },
	{ id: 'myself.project.test', title: localize2('testProject', "Tests"), icon: Codicon.beaker, taskCommand: 'workbench.action.tasks.test' },
].entries()) {
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: action.id,
				title: action.title,
				icon: action.icon,
				precondition: enabled,
				f1: false,
				menu: [
					{ id: MenuId.MenubarTerminalMenu, group: '2_project', order: index + 1 },
					{ id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', VIEW_ID), group: 'navigation', order: index + 1 },
				],
			});
		}

		override async run(accessor: ServicesAccessor): Promise<void> {
			const trust = accessor.get(IWorkspaceTrustManagementService);
			const instantiation = accessor.get(IInstantiationService);
			await trust.workspaceTrustInitialized;
			return instantiation.invokeFunction(accessor => {
				if (!trust.isWorkspaceTrusted()) {
					accessor.get(INotificationService).info(localize('projectTaskRequiresTrust', "Trust this workspace before running project tasks."));
					return;
				}
				return accessor.get(ICommandService).executeCommand<void>(action.taskCommand);
			});
		}
	});
}
