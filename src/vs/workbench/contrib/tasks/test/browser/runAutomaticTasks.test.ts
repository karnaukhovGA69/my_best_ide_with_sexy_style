/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { RunAutomaticTasks } from '../../browser/runAutomaticTasks.js';
import { ITaskService, IWorkspaceFolderTaskResult } from '../../common/taskService.js';
import { ConfiguringTask, RunOnOptions, Task, TaskSourceKind, WorkspaceFileTaskSource } from '../../common/tasks.js';

suite('Automatic task trust at execution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function setup(trusted = true, deferredTask = false) {
		const instantiation = workbenchInstantiationService(undefined, store);
		const state = { trusted, discoveries: 0, runs: 0 };
		const discovered = new DeferredPromise<Map<string, IWorkspaceFolderTaskResult>>();
		const resolved = new DeferredPromise<Task | undefined>();
		const source = upcastPartial<WorkspaceFileTaskSource>({ kind: TaskSourceKind.WorkspaceFile, config: { file: 'tasks.json', index: 0, element: {} } });
		const task = upcastPartial<Task>({ _label: 'local task', _source: source, runOptions: { runOn: RunOnOptions.folderOpen } });
		const configured = upcastPartial<ConfiguringTask>({ _id: 'local', _label: 'local task', _source: source, runOptions: { runOn: RunOnOptions.folderOpen } });
		const result = upcastPartial<IWorkspaceFolderTaskResult>(deferredTask
			? { configurations: { byIdentifier: { local: configured } } }
			: { set: { tasks: [task] } });
		instantiation.stub(IWorkspaceTrustManagementService, { isWorkspaceTrusted: () => state.trusted, onDidChangeTrust: Event.None });
		instantiation.stub(IConfigurationService, { inspect: () => ({ value: 'on', userValue: 'on' }), getValue: () => 'on' });
		instantiation.stub(ITaskService, {
			isReconnected: true, hasTaskSystemInfo: true,
			getWorkspaceTasks: () => { state.discoveries++; return discovered.p; },
			getTask: () => resolved.p,
			run: async () => { state.runs++; return undefined; }
		});
		const owner = store.add(instantiation.createInstance(RunAutomaticTasks));
		return { state, owner, resolved, task, discover: () => discovered.complete(new Map([['local', result]])) };
	}

	test('does not discover tasks in an untrusted workspace', async () => {
		const { state } = setup(false);
		await timeout(0);
		assert.deepStrictEqual(state, { trusted: false, discoveries: 0, runs: 0 });
	});

	test('runs allowed tasks while the workspace remains trusted', async () => {
		const fixture = setup();
		await fixture.discover();
		await timeout(0);
		assert.strictEqual(fixture.state.runs, 1);
	});

	for (const stage of ['discovery', 'resolution'] as const) {
		for (const stop of ['trust revoked', 'disposed'] as const) {
			test(`does not run after ${stop} during ${stage}`, async () => {
				const fixture = setup(true, stage === 'resolution');
				if (stage === 'resolution') {
					await fixture.discover();
					await timeout(0);
				}
				if (stop === 'trust revoked') {
					fixture.state.trusted = false;
				} else {
					fixture.owner.dispose();
				}
				if (stage === 'discovery') {
					await fixture.discover();
				} else {
					await fixture.resolved.complete(fixture.task);
				}
				await timeout(0);
				assert.strictEqual(fixture.state.runs, 0);
			});
		}
	}
});
