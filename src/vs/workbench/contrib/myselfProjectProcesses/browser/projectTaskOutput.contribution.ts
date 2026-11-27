/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { ITaskService, TaskCommandsRegistered, TaskExecutionSupportedContext } from '../../tasks/common/taskService.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { WorkspaceTrustContext } from '../../workspace/common/workspace.js';

registerAction2(class RunningProjectTasksAction extends Action2 {
	constructor() {
		super({
			id: 'myself.project.runningTasks',
			title: localize2('runningProjectTasks', "Running Project Tasks…"),
			precondition: ContextKeyExpr.and(WorkspaceTrustContext.IsTrusted, TaskExecutionSupportedContext, TaskCommandsRegistered),
			f1: false,
			menu: { id: MenuId.MenubarTerminalMenu, group: '2_project', order: 5 },
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const trust = accessor.get(IWorkspaceTrustManagementService);
		const instantiation = accessor.get(IInstantiationService);
		await trust.workspaceTrustInitialized;

		return instantiation.invokeFunction(async accessor => {
			const notifications = accessor.get(INotificationService);
			if (!trust.isWorkspaceTrusted()) {
				notifications.info(localize('runningTasksRequiresTrust', "Trust this workspace to manage its running tasks."));
				return;
			}

			const tasks = accessor.get(ITaskService);
			const quickInput = accessor.get(IQuickInputService);
			const workspace = accessor.get(IWorkspaceContextService);
			const workspaceId = workspace.getWorkspace().id;
			const runningTasks = await tasks.getActiveTasks();
			if (!runningTasks.length) {
				notifications.info(localize('noRunningProjectTasks', "No project tasks are running."));
				return;
			}

			const taskItems = runningTasks.map((task, index) => {
				const folder = task.getWorkspaceFolder();
				return {
					task,
					label: task._label || localize('unnamedRunningTask', "Unnamed Task"),
					description: folder?.name,
					detail: folder
						? localize('runningTaskInFolder', "Run {0} · {1}", index + 1, folder.uri.fsPath)
						: localize('runningWorkspaceTask', "Run {0} · Workspace", index + 1),
				};
			});
			const selected = await quickInput.pick(taskItems, { placeHolder: localize('selectRunningProjectTask', "Select a running project task") });
			if (!selected) {
				return;
			}

			const choice = await quickInput.pick([
				{ operation: 'output', label: localize('showProjectTaskOutput', "Show Terminal Output") },
				{ operation: 'stop', label: localize('stopProjectTask', "Stop Task") },
			], { title: selected.label, placeHolder: localize('selectRunningProjectTaskAction', "Choose what to do with the selected task") });
			if (!choice) {
				return;
			}

			// The task system clones a task for each run. Its map key can be reused after a run ends.
			const stillRunning = (await tasks.getActiveTasks()).includes(selected.task);
			if (!trust.isWorkspaceTrusted() || workspace.getWorkspace().id !== workspaceId) {
				return;
			}
			if (!stillRunning) {
				notifications.info(localize('projectTaskNoLongerRunning', "The selected task is no longer running."));
				return;
			}

			if (choice.operation === 'stop') {
				const result = await tasks.terminate(selected.task, { requireActiveInstance: true });
				if (!result.success || !result.task) {
					notifications.warn(localize('projectTaskNotStopped', "The selected task could not be stopped."));
				}
				return;
			}

			const resources = tasks.getTerminalsForTasks(selected.task);
			const terminal = instantiation.invokeFunction(accessor => accessor.get(ITerminalService));
			const instance = resources?.length === 1 ? terminal.getInstanceFromResource(resources[0]) : undefined;
			if (!instance || instance.isDisposed) {
				notifications.info(localize('projectTaskOutputUnavailable', "The terminal output for this task is unavailable."));
				return;
			}

			terminal.setActiveInstance(instance);
			await terminal.revealTerminal(instance);
		});
	}
});
