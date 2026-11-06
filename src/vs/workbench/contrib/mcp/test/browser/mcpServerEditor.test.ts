/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Dimension } from '../../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { McpServerEditor } from '../../browser/mcpServerEditor.js';
import { McpServerEditorInput } from '../../browser/mcpServerEditorInput.js';
import { IMcpServerEditorOptions, IWorkbenchMcpServer, McpServerEditorTab } from '../../common/mcpTypes.js';

suite('Workbench - MCP - server editor runtime removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEditor() {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[ITelemetryService, NullTelemetryService],
			[IThemeService, new TestThemeService()],
			[IStorageService, store.add(new TestStorageService())],
		), true));
		return store.add(instantiation.createInstance(McpServerEditor, upcastPartial<IEditorGroup>({})));
	}

	function mount(editor: McpServerEditor) {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		editor.create(parent);
		return parent;
	}

	test('constructs with only base editor services and renders no actions, links or webviews', () => {
		const editor = createEditor();
		const parent = mount(editor);
		assert.strictEqual(editor.getId(), 'workbench.editor.mcpServer');
		assert.strictEqual(parent.textContent, 'MCP servers are not available in this edition of the editor.');
		assert.strictEqual(parent.querySelectorAll('button, a, input, iframe, webview').length, 0);
		assert.strictEqual(editor.activeWebview, undefined);
	});

	test('restored inputs and tab options never inspect server metadata or load manifests/readmes', async () => {
		const editor = createEditor();
		mount(editor);
		const server = new Proxy(upcastPartial<IWorkbenchMcpServer>({}), { get() { throw new Error('MCP server metadata accessed'); } });
		for (const tab of [McpServerEditorTab.Readme, McpServerEditorTab.Manifest, McpServerEditorTab.Configuration]) {
			const input = store.add(new McpServerEditorInput(server));
			const options: IMcpServerEditorOptions = { tab };
			await editor.setInput(input, options, { newInGroup: true }, CancellationToken.None);
			editor.setOptions(options);
			assert.strictEqual(editor.input, input);
			editor.showFind();
			editor.runFindAction(false);
			editor.runFindAction(true);
			editor.clearInput();
			assert.strictEqual(editor.input, undefined);
		}
	});

	test('message supports keyboard focus and layout and is removed on disposal', () => {
		const editor = createEditor();
		editor.layout(new Dimension(200, 100));
		const parent = mount(editor);
		editor.layout(new Dimension(320, 240));
		editor.focus();
		const message = parent.firstElementChild as HTMLElement;
		assert.strictEqual(document.activeElement, message);
		assert.strictEqual(message.getAttribute('role'), 'document');
		assert.strictEqual(message.style.width, '320px');
		assert.strictEqual(message.style.height, '240px');
		editor.dispose();
		editor.dispose();
		assert.strictEqual(parent.childElementCount, 0);
	});
});
