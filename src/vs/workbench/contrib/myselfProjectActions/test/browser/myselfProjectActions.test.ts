/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContext } from '../../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import '../../browser/myselfProjectActions.contribution.js';

suite('Project task actions', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const actions = [
		['myself.project.runTask', 'workbench.action.tasks.runTask'],
		['myself.project.build', 'workbench.action.tasks.build'],
		['myself.project.test', 'workbench.action.tasks.test'],
	] as const;

	function fixture(initialized = Promise.resolve()) {
		let trusted = true;
		const requested: string[] = [];
		const dispatched: { command: string; args: readonly object[] }[] = [];
		const notices: string[] = [];
		let dispatch = async (): Promise<void> => { };
		const trust = new class extends mock<IWorkspaceTrustManagementService>() {
			override readonly workspaceTrustInitialized = initialized;
			override isWorkspaceTrusted(): boolean { return trusted; }
		}();
		class Commands extends mock<ICommandService>() {
			constructor() {
				super();
				requested.push(ICommandService.toString());
			}
			override async executeCommand<T>(command: string, ...args: object[]): Promise<T> {
				dispatched.push({ command, args });
				await dispatch();
				return undefined as T;
			}
		}
		class Notifications extends mock<INotificationService>() {
			constructor() {
				super();
				requested.push(INotificationService.toString());
			}
			override info(message: string): void { notices.push(message); }
		}
		const services = new ServiceCollection(
			[IWorkspaceTrustManagementService, trust],
			[ICommandService, new SyncDescriptor(Commands)],
			[INotificationService, new SyncDescriptor(Notifications)],
		);
		const instantiation = store.add(new InstantiationService(services, true));
		const run = (command: string, ...args: (string | object)[]) => Promise.resolve(instantiation.invokeFunction(CommandsRegistry.getCommand(command)!.handler, ...args));
		return {
			run, requested, dispatched, notices,
			setTrusted: (value: boolean) => { trusted = value; },
			setDispatch: (value: () => Promise<void>) => { dispatch = value; },
		};
	}

	for (const [command, taskCommand] of actions) {
		test(`${command} refuses direct untrusted invocation before requesting task or command services`, async () => {
			const state = fixture();
			state.setTrusted(false);
			await state.run(command);
			assert.deepStrictEqual({ services: state.requested, dispatched: state.dispatched, notices: state.notices.length }, {
				services: [INotificationService.toString()], dispatched: [], notices: 1,
			});
		});

		test(`${command} waits for initialization and checks trust after it`, async () => {
			const initialized = new DeferredPromise<void>();
			const state = fixture(initialized.p);
			const result = state.run(command);
			assert.deepStrictEqual({ services: state.requested, dispatched: state.dispatched }, {
				services: [], dispatched: [],
			});
			state.setTrusted(false);
			await initialized.complete();
			await result;
			assert.deepStrictEqual({ dispatched: state.dispatched, notices: state.notices.length }, { dispatched: [], notices: 1 });
		});

		test(`${command} dispatches only ${taskCommand}, ignoring external task and folder arguments`, async () => {
			const state = fixture();
			await state.run(command, 'untrusted-command', { task: 'same-label', folder: '/second-root' });
			assert.deepStrictEqual({ dispatched: state.dispatched, notices: state.notices }, {
				dispatched: [{ command: taskCommand, args: [] }], notices: [],
			});
		});
	}

	test('Run waits for the standard picker and cancellation completes without fallback or success feedback', async () => {
		const state = fixture();
		const selection = new DeferredPromise<void>();
		state.setDispatch(() => selection.p);
		let completed = false;
		const result = state.run('myself.project.runTask').then(() => { completed = true; });
		await Promise.resolve();
		assert.strictEqual(completed, false);
		await selection.complete();
		await result;
		assert.deepStrictEqual({ dispatched: state.dispatched, notices: state.notices }, { dispatched: [{ command: 'workbench.action.tasks.runTask', args: [] }], notices: [] });
	});

	test('standard command errors propagate without retrying another task', async () => {
		const state = fixture();
		const error = new Error('task provider failed');
		state.setDispatch(async () => { throw error; });
		await assert.rejects(state.run('myself.project.runTask'), error);
		assert.deepStrictEqual(state.dispatched, [{ command: 'workbench.action.tasks.runTask', args: [] }]);
	});

	test('initialization failure never activates commands or dispatches a task', async () => {
		const initialized = new DeferredPromise<void>();
		const state = fixture(initialized.p);
		const error = new Error('workspace initialization failed');
		const result = state.run('myself.project.runTask');
		await initialized.error(error);
		await assert.rejects(result, error);
		assert.deepStrictEqual({ requested: state.requested, dispatched: state.dispatched }, { requested: [], dispatched: [] });
	});

	test('opening the menus only exposes static actions and disables them in Restricted Mode', () => {
		const state = fixture();
		const context = (trusted: boolean, view = 'workbench.explorer.fileView'): IContext => ({
			getValue<T>(key: string): T | undefined {
				const values: Record<string, string | boolean> = { isWorkspaceTrusted: trusted, taskCommandsRegistered: true, shellExecutionSupported: true, processExecutionSupported: true, view };
				return values[key] as T | undefined;
			},
		});
		for (const menu of [MenuId.MenubarTerminalMenu, MenuId.ViewTitle]) {
			const items = MenuRegistry.getMenuItems(menu).filter(isIMenuItem).filter(item => actions.some(([id]) => item.command.id === id));
			assert.deepStrictEqual(items.map(item => ({
				id: item.command.id,
				visible: !item.when || item.when.evaluate(context(false)),
				enabled: item.command.precondition?.evaluate(context(false)),
			})), actions.map(([id]) => ({ id, visible: true, enabled: false })));
			assert.ok(items.every(item => item.command.precondition?.evaluate(context(true))));
			if (menu === MenuId.ViewTitle) {
				assert.ok(items.every(item => !item.when?.evaluate(context(true, 'unrelated-view'))));
			}
		}
		assert.deepStrictEqual({ requested: state.requested, dispatched: state.dispatched }, { requested: [], dispatched: [] });
	});
});
