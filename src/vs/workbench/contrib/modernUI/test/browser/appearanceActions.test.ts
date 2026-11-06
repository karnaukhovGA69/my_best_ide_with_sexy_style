/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MenuId, MenuRegistry, isIMenuItem, isISubmenuItem } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { LayoutDensityMenu } from '../../../../browser/actions/layoutDensityActions.js';
import { LayoutSettings } from '../../../../services/layout/browser/layoutService.js';
import '../../browser/appearanceActions.js';

suite('Myself IDE appearance controls', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('offers the same Classic/Modern submenu in Appearance and Settings', () => {
		for (const menu of [MenuId.MenubarAppearanceMenu, MenuId.GlobalActivity]) {
			const entry = MenuRegistry.getMenuItems(menu).filter(isISubmenuItem).find(item => item.submenu.id === 'MyselfInterfaceStyle');
			assert.ok(entry);
			assert.deepStrictEqual(MenuRegistry.getMenuItems(entry.submenu).filter(isIMenuItem).map(item => item.command.id), ['myself.appearance.classic', 'myself.appearance.modern']);
		}
	});

	test('changes only the existing layout flag, preserving theme, fonts and density', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const changes: [string, unknown][] = [];
		instantiation.stub(IConfigurationService, { updateValue: async (key: string, value: unknown) => { changes.push([key, value]); } });
		for (const id of ['myself.appearance.classic', 'myself.appearance.modern']) {
			await instantiation.invokeFunction(CommandsRegistry.getCommand(id)!.handler);
		}
		assert.deepStrictEqual(changes, [[LayoutSettings.MODERN_UI, false], [LayoutSettings.MODERN_UI, true]]);
	});

	test('shows density controls only for modern layout and reuses existing commands', () => {
		const entry = MenuRegistry.getMenuItems(MenuId.MenubarAppearanceMenu).filter(isISubmenuItem).find(item => item.submenu === LayoutDensityMenu);
		assert.ok(entry?.when);
		const context = store.add(new MockContextKeyService());
		const modern = context.createKey<boolean>(`config.${LayoutSettings.MODERN_UI}`, false);
		assert.strictEqual(entry.when.evaluate({ getValue: key => context.getContextKeyValue(key) }), false);
		modern.set(true);
		assert.strictEqual(entry.when.evaluate({ getValue: key => context.getContextKeyValue(key) }), true);
		assert.deepStrictEqual(MenuRegistry.getMenuItems(entry.submenu).filter(isIMenuItem).map(item => item.command.id), ['workbench.action.setLayoutDensity.default', 'workbench.action.setLayoutDensity.compact']);
	});

	test('propagates a settings write failure instead of reporting success', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const failure = new Error('synthetic write failure');
		instantiation.stub(IConfigurationService, { updateValue: async () => { throw failure; } });
		await assert.rejects(async () => instantiation.invokeFunction(CommandsRegistry.getCommand('myself.appearance.classic')!.handler), error => error === failure);
	});
});
