/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $, append, getWindow } from '../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationChangeEvent } from '../../../../../platform/configuration/common/configuration.js';
import { CalmerStudioContribution, CALMER_STUDIO_CLASS } from '../../browser/calmerStudio.js';
import { CalmerStudioMetrics, IWorkbenchLayoutService, LayoutSettings, isCalmerStudio } from '../../../../services/layout/browser/layoutService.js';
import { IAuxiliaryWindow, IAuxiliaryWindowService } from '../../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { BrowserTitlebarPart } from '../../../../browser/parts/titlebar/titlebarPart.js';
import { MainStatusbarPart, AuxiliaryStatusbarPart } from '../../../../browser/parts/statusbar/statusbarPart.js';
import { EditorTabsControl } from '../../../../browser/parts/editor/editorTabsControl.js';
import { ExplorerDelegate } from '../../../files/browser/views/explorerViewer.js';
import { ExplorerView } from '../../../files/browser/views/explorerView.js';
import { ExplorerItem } from '../../../files/common/explorerModel.js';
import { URI } from '../../../../../base/common/uri.js';
import '../../../../browser/parts/statusbar/media/statusbarpart.css';
import '../../../../browser/parts/editor/media/multieditortabscontrol.css';
import '../../../files/browser/media/explorerviewlet.css';

suite('Calmer Studio layout', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function setup(enabled = false, modern = false) {
		const config = new TestConfigurationService({ [LayoutSettings.CALMER_STUDIO]: enabled, [LayoutSettings.MODERN_UI]: modern });
		store.add(config.onDidChangeConfigurationEmitter);
		const main = append(document.body, $('.monaco-workbench'));
		const auxiliary = append(document.body, $('.monaco-workbench'));
		store.add(toDisposable(() => { main.remove(); auxiliary.remove(); }));
		const containers = [main, auxiliary];
		const added = store.add(new Emitter<{ container: HTMLElement; disposables: DisposableStore }>());
		let layouts = 0;
		let auxiliaryLayouts = 0;
		const layout = new class extends mock<IWorkbenchLayoutService>() {
			override readonly mainContainer = main;
			override readonly containers = containers;
			override readonly onDidAddContainer = added.event;
			override layout(): void { layouts++; }
		};
		const windows = new class extends mock<IAuxiliaryWindowService>() {
			override getWindow() { return new class extends mock<IAuxiliaryWindow>() { override layout(): void { auxiliaryLayouts++; } }(); }
		};
		const contribution = store.add(new CalmerStudioContribution(config, layout, windows));
		async function change(key: string, value: boolean) {
			await config.setUserConfiguration(key, value);
			config.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: candidate => candidate === key } as IConfigurationChangeEvent);
		}
		return { config, main, auxiliary, containers, added, contribution, change, layouts: () => layouts, auxiliaryLayouts: () => auxiliaryLayouts };
	}

	test('default is inert and startup preserves settings and existing container state', () => {
		const fixture = setup();
		assert.strictEqual(fixture.main.classList.contains(CALMER_STUDIO_CLASS), false);
		assert.strictEqual(fixture.layouts(), 0);
		assert.strictEqual(fixture.config.getValue(LayoutSettings.MODERN_UI), false);
	});

	test('enabling updates both windows and leaves unrelated settings alone', async () => {
		const fixture = setup();
		await fixture.change(LayoutSettings.CALMER_STUDIO, true);
		for (const container of fixture.containers) {
			assert.ok(container.classList.contains(CALMER_STUDIO_CLASS));
		}
		assert.strictEqual(fixture.layouts(), 1);
		assert.strictEqual(fixture.auxiliaryLayouts(), 1);
		await fixture.change('editor.minimap.enabled', true);
		assert.strictEqual(fixture.layouts(), 1);
		assert.strictEqual(fixture.config.getValue('editor.minimap.enabled'), true);
	});

	test('Modern never mixes with Calmer and switching back restores Calmer', async () => {
		const fixture = setup(true);
		await fixture.change(LayoutSettings.MODERN_UI, true);
		assert.strictEqual(isCalmerStudio(fixture.config), false);
		assert.strictEqual(fixture.main.classList.contains(CALMER_STUDIO_CLASS), false);
		assert.strictEqual(fixture.config.getValue(LayoutSettings.CALMER_STUDIO), true);
		await fixture.change(LayoutSettings.MODERN_UI, false);
		assert.ok(fixture.main.classList.contains(CALMER_STUDIO_CLASS));
		await fixture.change(LayoutSettings.CALMER_STUDIO, false);
		assert.strictEqual(fixture.main.classList.contains(CALMER_STUDIO_CLASS), false);
		assert.strictEqual(fixture.layouts(), 3);
	});

	test('new containers inherit state and disposal removes only owned styles', async () => {
		const fixture = setup(true);
		const extra = document.createElement('div');
		extra.className = 'unrelated';
		extra.style.setProperty('--custom-color', 'red');
		fixture.containers.push(extra);
		fixture.added.fire({ container: extra, disposables: store.add(new DisposableStore()) });
		assert.ok(extra.classList.contains(CALMER_STUDIO_CLASS));
		fixture.contribution.dispose();
		assert.strictEqual(extra.className, 'unrelated');
		assert.strictEqual(extra.style.getPropertyValue('--custom-color'), 'red');
		await fixture.change(LayoutSettings.CALMER_STUDIO, false);
		assert.strictEqual(fixture.layouts(), 0);
	});

	test('part constraints use Calmer heights and restore classic heights', async () => {
		const fixture = setup(true);
		const receiver = { configurationService: fixture.config, isCommandCenterVisible: false, preventZoom: false, floatingBottomPadding: 0 };
		assert.strictEqual(Reflect.get(BrowserTitlebarPart.prototype, 'minimumHeight', receiver), 48);
		for (const prototype of [MainStatusbarPart.prototype, AuxiliaryStatusbarPart.prototype]) {
			assert.strictEqual(Reflect.get(prototype, 'minimumHeight', receiver), 32);
			assert.strictEqual(Reflect.get(prototype, 'maximumHeight', receiver), 32);
		}
		await fixture.change(LayoutSettings.CALMER_STUDIO, false);
		assert.strictEqual(Reflect.get(BrowserTitlebarPart.prototype, 'minimumHeight', receiver), 30);
		assert.strictEqual(Reflect.get(MainStatusbarPart.prototype, 'minimumHeight', receiver), 22);
	});

	test('tab height respects compact preference and restores the native CSS variable', async () => {
		const fixture = setup(true);
		const part = append(fixture.main, $('.part.editor'));
		const content = append(part, $('.content'));
		const group = append(content, $('.editor-group-container'));
		const parent = append(group, $('.title.tabs'));
		const strip = append(parent, $('.tabs-and-actions-container'));
		const scrollable = append(strip, $('.monaco-scrollable-element'));
		const tabs = append(scrollable, $('.tabs-container'));
		const tab = append(tabs, $('.tab'));
		const receiver = { configurationService: fixture.config, groupsView: { partOptions: { tabHeight: 'default' } }, parent, useModernUITabs: false };
		const height = () => Reflect.get(EditorTabsControl.prototype, 'tabHeight', receiver);
		Object.defineProperty(receiver, 'tabHeight', { get: height });
		const updateHeight = () => Reflect.get(EditorTabsControl.prototype, 'updateTabHeight').call(receiver);
		updateHeight();
		assert.strictEqual(getWindow(tab).getComputedStyle(tab).height, '44px');
		assert.strictEqual(height(), 44);
		receiver.groupsView.partOptions.tabHeight = 'compact';
		assert.strictEqual(height(), 32);
		updateHeight();
		assert.strictEqual(getWindow(tab).getComputedStyle(tab).height, '32px');
		await fixture.change(LayoutSettings.CALMER_STUDIO, false);
		assert.strictEqual(height(), 22);
		receiver.groupsView.partOptions.tabHeight = 'default';
		assert.strictEqual(height(), 35);
		updateHeight();
		assert.strictEqual(getWindow(tab).getComputedStyle(tab).height, '35px');
	});

	test('Explorer delegate and loaded nested rows update together on a mode change', async () => {
		const fixture = setup(true);
		const rowHeight = () => isCalmerStudio(fixture.config) ? CalmerStudioMetrics.fileRowHeight : ExplorerDelegate.ITEM_HEIGHT;
		const delegate = new ExplorerDelegate(rowHeight);
		const parent = Object.assign(Object.create(ExplorerItem.prototype), { resource: URI.file('/project/src') }) as ExplorerItem;
		const child = Object.assign(Object.create(ExplorerItem.prototype), { resource: URI.file('/project/src/app.ts') }) as ExplorerItem;
		const updates: Array<[ExplorerItem, number]> = [];
		let padding = 0;
		const receiver = {
			configurationService: fixture.config,
			get fileRowHeight() { return rowHeight(); },
			tree: {
				getInput: () => [parent],
				getNode: () => ({ children: [{ element: parent, children: [{ element: child, children: [] }] }] }),
				updateOptions: (options: { paddingBottom: number }) => padding = options.paddingBottom,
				updateElementHeight: (item: ExplorerItem, height: number) => updates.push([item, height]),
			}
		};
		const event = { affectsConfiguration: (key: string) => key === LayoutSettings.CALMER_STUDIO };
		const update = Reflect.get(ExplorerView.prototype, 'onConfigurationUpdated');
		update.call(receiver, event);
		assert.strictEqual(delegate.getHeight(child), 30);
		assert.deepStrictEqual(updates, [[parent, 30], [child, 30]]);
		assert.strictEqual(padding, 30);
		updates.length = 0;
		await fixture.change(LayoutSettings.CALMER_STUDIO, false);
		update.call(receiver, event);
		assert.strictEqual(delegate.getHeight(child), 22);
		assert.deepStrictEqual(updates, [[parent, 22], [child, 22]]);
	});

	test('actual CSS centers file and status rows and remains scoped in HC', async () => {
		const fixture = setup(true);
		fixture.main.classList.add('hc-black');
		fixture.main.style.setProperty('--vscode-cornerRadius-small', '4px');
		const status = append(fixture.main, $('.part.statusbar'));
		const items = append(status, $('.items-container.left-items'));
		const item = append(items, $('.statusbar-item'));
		item.textContent = 'main';
		const explorer = append(fixture.main, $('.explorer-folders-view'));
		const row = append(explorer, $('.explorer-item'));
		const label = append(row, $('.monaco-icon-label'));
		label.textContent = 'app.ts';
		assert.strictEqual(getWindow(status).getComputedStyle(status).height, `${CalmerStudioMetrics.statusBarHeight}px`);
		assert.strictEqual(getWindow(item).getComputedStyle(item).lineHeight, `${CalmerStudioMetrics.statusBarHeight}px`);
		assert.strictEqual(getWindow(row).getComputedStyle(row).height, `${CalmerStudioMetrics.fileRowHeight}px`);
		assert.strictEqual(getWindow(label).getComputedStyle(label).lineHeight, `${CalmerStudioMetrics.fileRowHeight}px`);
		assert.strictEqual(getWindow(label).getComputedStyle(label).filter, 'none');
		await fixture.change(LayoutSettings.CALMER_STUDIO, false);
		assert.strictEqual(getWindow(status).getComputedStyle(status).height, '22px');
		assert.strictEqual(getWindow(item).getComputedStyle(item).lineHeight, '22px');
		assert.strictEqual(getWindow(row).getComputedStyle(row).height, '22px');
	});
});
