/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService, WorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { ITaskService } from '../../../tasks/common/taskService.js';
import { CustomTask, RunOptions, Task } from '../../../tasks/common/tasks.js';
import { ITerminalInstance, ITerminalService } from '../../../terminal/browser/terminal.js';
import '../../browser/projectTaskOutput.contribution.js';

suite('Running project tasks', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const commandId = 'myself.project.runningTasks';
	const firstFolder = new WorkspaceFolder({ uri: URI.file('/example/first'), name: 'First', index: 0 });
	const secondFolder = new WorkspaceFolder({ uri: URI.file('/example/second'), name: 'Second', index: 1 });

	function makeTask(folder = firstFolder): Task {
		const source = { kind: 'workspace', label: 'Workspace', config: { workspaceFolder: folder, file: '.vscode/tasks.json', index: 0, element: {} } } as const;
		return new CustomTask('compile', source, 'Compile', 'shell', undefined, false, RunOptions.defaults, {});
	}

	function fixture(activeTasks: Task[] = []) {
		const picks: (number | (() => number | undefined) | undefined)[] = [];
		const offered: IQuickPickItem[][] = [];
		const terminated: Task[] = [];
		const switched: ITerminalInstance[] = [];
		const revealed: ITerminalInstance[] = [];
		const requestedTargets: Task[] = [];
		const notices: string[] = [];
		let active = activeTasks;
		let trusted = true;
		let workspaceId = 'example';
		let activeReads = 0;
		const terminalResources = new Map<Task, URI[]>();
		const instances = new Map<string, ITerminalInstance>();
		const tasks = new class extends mock<ITaskService>() {
			override async getActiveTasks(): Promise<Task[]> {
				activeReads++;
				return active;
			}
			override async terminate(task: Task, options?: Parameters<ITaskService['terminate']>[1]) {
				assert.deepStrictEqual(options, { requireActiveInstance: true });
				terminated.push(task);
				return { success: true, task };
			}
			override getTerminalsForTasks(task: Parameters<ITaskService['getTerminalsForTasks']>[0]): URI[] | undefined {
				assert.ok(!Array.isArray(task));
				requestedTargets.push(task);
				return terminalResources.get(task);
			}
		}();
		const quickInput = new class extends mock<IQuickInputService>() {
			override pick = (async (items: IQuickPickItem[]) => {
				offered.push(items);
				const pick = picks.shift();
				const result = typeof pick === 'function' ? pick() : pick;
				return result === undefined ? undefined : items[result];
			}) as IQuickInputService['pick'];
		}();
		const trust = new class extends mock<IWorkspaceTrustManagementService>() {
			override readonly workspaceTrustInitialized = Promise.resolve();
			override isWorkspaceTrusted(): boolean { return trusted; }
		}();
		const workspace = new class extends mock<IWorkspaceContextService>() {
			override getWorkspace() { return { id: workspaceId, folders: [firstFolder, secondFolder] }; }
		}();
		const terminal = new class extends mock<ITerminalService>() {
			override getInstanceFromResource(resource: Parameters<ITerminalService['getInstanceFromResource']>[0]) {
				return resource?.path ? instances.get(resource.path) : undefined;
			}
			override setActiveInstance(instance: ITerminalInstance | undefined): void {
				assert.ok(instance);
				switched.push(instance);
			}
			override async revealTerminal(instance: ITerminalInstance): Promise<void> { revealed.push(instance); }
		}();
		const notifications = new class extends mock<INotificationService>() {
			override info(message: string): void { notices.push(message); }
		}();
		return {
			picks, offered, terminated, switched, revealed, notices, requestedTargets, terminalResources,
			setActive: (value: Task[]) => { active = value; },
			setTrusted: (value: boolean) => { trusted = value; },
			setWorkspaceId: (value: string) => { workspaceId = value; },
			getActiveReads: () => activeReads,
			addTerminal(task: Task, resource: URI, isDisposed = false): ITerminalInstance {
				const instance = new class extends mock<ITerminalInstance>() {
					override readonly resource = resource;
					override readonly isDisposed = isDisposed;
				}();
				instances.set(resource.path, instance);
				terminalResources.set(task, [resource]);
				return instance;
			},
			async run(...args: string[]): Promise<void> {
				const instantiation = store.add(new InstantiationService(new ServiceCollection(
					[ITaskService, tasks], [IQuickInputService, quickInput], [IWorkspaceTrustManagementService, trust],
					[IWorkspaceContextService, workspace], [ITerminalService, terminal], [INotificationService, notifications],
				), true));
				await instantiation.invokeFunction(CommandsRegistry.getCommand(commandId)!.handler, ...args);
			},
		};
	}

	test('registration exposes one Terminal menu action without looking up tasks', () => {
		const state = fixture();
		const items = MenuRegistry.getMenuItems(MenuId.MenubarTerminalMenu).filter(isIMenuItem).filter(item => item.command.id === commandId);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(state.getActiveReads(), 0);
	});

	test('the task choice distinguishes equal names in separate roots and stops only the chosen object', async () => {
		const first = makeTask();
		const second = makeTask(secondFolder);
		const state = fixture([first, second]);
		state.picks.push(1, 1);
		await state.run(first.getMapKey());
		assert.deepStrictEqual(state.offered[0].map(item => [item.label, item.description]), [['Compile', 'First'], ['Compile', 'Second']]);
		assert.strictEqual(state.terminated.length, 1);
		assert.strictEqual(state.terminated[0], second);
		assert.deepStrictEqual(state.revealed, []);
	});

	test('a replacement with the same task key is not stopped after the operation picker', async () => {
		const original = makeTask();
		const replacement = original.clone();
		assert.strictEqual(original.getMapKey(), replacement.getMapKey());
		const state = fixture([original]);
		state.picks.push(0, () => {
			state.setActive([replacement]);
			return 1;
		});
		await state.run();
		assert.deepStrictEqual(state.terminated, []);
		assert.match(state.notices[0], /no longer running/);
	});

	test('cancelling either picker or opening an empty task list does not touch terminals', async () => {
		for (const [active, picks, shown] of [[[], [], 0], [[makeTask()], [undefined], 1], [[makeTask()], [0, undefined], 2]] as const) {
			const state = fixture([...active]);
			state.picks.push(...picks);
			await state.run();
			assert.strictEqual(state.offered.length, shown);
			assert.deepStrictEqual([state.terminated, state.requestedTargets, state.revealed], [[], [], []]);
		}
	});

	test('direct untrusted invocation does not query tasks and lost trust disables stopping', async () => {
		const state = fixture([makeTask()]);
		state.setTrusted(false);
		await state.run();
		assert.strictEqual(state.getActiveReads(), 0);
		state.setTrusted(true);
		state.picks.push(0, () => {
			state.setTrusted(false);
			return 1;
		});
		await state.run();
		assert.deepStrictEqual(state.terminated, []);
	});

	test('changing workspace while choosing an operation cancels the selection', async () => {
		const state = fixture([makeTask()]);
		state.picks.push(0, () => {
			state.setWorkspaceId('other-workspace');
			return 1;
		});
		await state.run();
		assert.deepStrictEqual(state.terminated, []);
	});

	test('showing output activates and reveals the selected task terminal only', async () => {
		const first = makeTask();
		const second = makeTask(secondFolder);
		const state = fixture([first, second]);
		state.addTerminal(first, URI.from({ scheme: 'vscode-terminal', path: '/example/1' }));
		const expected = state.addTerminal(second, URI.from({ scheme: 'vscode-terminal', path: '/example/2' }));
		state.picks.push(1, 0);
		await state.run();
		assert.deepStrictEqual(state.requestedTargets, [second]);
		assert.strictEqual(state.switched[0], expected);
		assert.strictEqual(state.revealed[0], expected);
		assert.deepStrictEqual(state.terminated, []);
	});

	test('ambiguous output and disposed terminals never reveal an unrelated terminal', async () => {
		const task = makeTask();
		const state = fixture([task]);
		const disposed = state.addTerminal(task, URI.from({ scheme: 'vscode-terminal', path: '/example/1' }), true);
		state.picks.push(0, 0, 0, 0);
		await state.run();
		state.terminalResources.set(task, [disposed.resource, URI.from({ scheme: 'vscode-terminal', path: '/example/2' })]);
		await state.run();
		assert.deepStrictEqual([state.switched, state.revealed], [[], []]);
		assert.strictEqual(state.notices.length, 2);
	});
});
