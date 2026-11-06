/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ICommandService, CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { ILifecycleService, StartupKind } from '../../../../services/lifecycle/common/lifecycle.js';
import { isResourceEditorInput } from '../../../../common/editor.js';
import { StartupPageRunnerContribution } from '../../browser/startupPage.js';
import { TerminalCommandId } from '../../../terminal/common/terminal.js';
import '../../browser/gettingStarted.contribution.js';

suite('Startup without Welcome', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	async function run(value: string, options: { files?: string[]; reload?: boolean; active?: boolean; skip?: boolean; trusted?: boolean; trustReady?: Promise<void> } = {}) {
		const instantiation = store.add(new TestInstantiationService());
		const calls: string[] = [];
		instantiation.stub(IWorkspaceTrustManagementService, { workspaceTrustInitialized: options.trustReady ?? Promise.resolve(), isWorkspaceTrusted: () => options.trusted !== false });
		instantiation.stub(IConfigurationService, {});
		instantiation.stub(IConfigurationService, 'inspect', () => ({ value, userValue: value }));
		instantiation.stub(IEditorService, {
			get activeEditor() { return options.active ? {} as never : undefined; },
			openEditors: async editors => { calls.push(...editors.map(editor => 'open:' + (isResourceEditorInput(editor) ? editor.resource?.path : 'other'))); return []; }
		});
		instantiation.stub(IFileService, {});
		instantiation.stub(IFileService, 'resolve', async () => { calls.push('resolve'); return { children: (options.files ?? []).map(name => ({ name })) }; });
		instantiation.stub(IWorkspaceContextService, {});
		instantiation.stub(IWorkspaceContextService, 'getWorkspace', () => ({ folders: [{ uri: URI.file('/project') }] }));
		instantiation.stub(ILifecycleService, { startupKind: options.reload ? StartupKind.ReloadedWindow : StartupKind.NewWindow, when: async () => { } });
		instantiation.stub(IWorkbenchLayoutService, { openedDefaultEditors: false, hasFocus: () => false });
		instantiation.stub(ICommandService, {});
		instantiation.stub(ICommandService, 'executeCommand', async (id: string) => { calls.push(id); });
		instantiation.stub(IWorkbenchEnvironmentService, { skipWelcome: options.skip });
		instantiation.stub(INotificationService, {});
		instantiation.stub(INotificationService, 'error', () => { calls.push('error'); });
		instantiation.stub(IContextKeyService, {});
		instantiation.stub(IContextKeyService, 'getContextKeyValue', () => false);
		store.add(instantiation.createInstance(StartupPageRunnerContribution));
		await timeout(0);
		return calls;
	}

	for (const value of ['none', 'welcomePage', 'welcomePageInEmptyWorkbench', 'agentSessionsWelcomePage']) {
		test(`does not open or restore the obsolete ${value} page`, async () => {
			assert.deepStrictEqual(await run(value), []);
		});
	}
	test('still opens the requested terminal on a fresh empty window', async () => {
		assert.deepStrictEqual(await run('terminal'), [TerminalCommandId.CreateTerminalEditor]);
	});
	test('does not automatically create a terminal in an untrusted workspace', async () => {
		assert.deepStrictEqual(await run('terminal', { trusted: false }), []);
	});
	test('waits for trust initialization before automatically creating a terminal', async () => {
		const ready = new DeferredPromise<void>();
		const calls = await run('terminal', { trustReady: ready.p });
		assert.deepStrictEqual(calls, []);
		await ready.complete();
		await timeout(0);
		assert.deepStrictEqual(calls, [TerminalCommandId.CreateTerminalEditor]);
	});
	test('uses resolved trust and preserves an editor opened while trust initializes', async () => {
		for (const blockedBy of ['trust', 'editor']) {
			const ready = new DeferredPromise<void>();
			const options = { trustReady: ready.p, trusted: true, active: false };
			const calls = await run('terminal', options);
			if (blockedBy === 'trust') {
				options.trusted = false;
			} else {
				options.active = true;
			}
			await ready.complete();
			await timeout(0);
			assert.deepStrictEqual(calls, []);
		}
	});
	test('still opens local README in an untrusted workspace without waiting for trust', async () => {
		assert.deepStrictEqual(await run('readme', { files: ['README.txt'], trusted: false, trustReady: new Promise<void>(() => {}) }), ['resolve', 'open:/project/README.txt']);
	});
	test('does not replace restored editors or run again on reload', async () => {
		assert.deepStrictEqual(await run('terminal', { active: true }), []);
		assert.deepStrictEqual(await run('terminal', { reload: true }), []);
		assert.deepStrictEqual(await run('terminal', { skip: true }), []);
	});
	test('opens Markdown README through the existing preview command', async () => {
		assert.deepStrictEqual(await run('readme', { files: ['README.md'] }), ['resolve', 'markdown.showPreview']);
	});
	test('opens a plain README without invoking Markdown preview', async () => {
		assert.deepStrictEqual(await run('readme', { files: ['README.txt'] }), ['resolve', 'open:/project/README.txt']);
	});
	test('missing README leaves the editor empty instead of opening Welcome', async () => {
		assert.deepStrictEqual(await run('readme'), ['resolve']);
	});
	test('does not register Welcome or walkthrough UI commands', () => {
		for (const id of ['workbench.action.openWalkthrough', 'welcome.goBack', 'walkthroughs.selectStep', 'welcome.markStepComplete', 'welcome.markStepIncomplete', 'welcome.showAllWalkthroughs']) {
			assert.strictEqual(CommandsRegistry.getCommand(id), undefined, id);
		}
	});
});
