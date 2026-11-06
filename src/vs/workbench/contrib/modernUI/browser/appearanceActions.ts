/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './textSizeActions.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { LayoutDensityMenu } from '../../../browser/actions/layoutDensityActions.js';
import { LayoutSettings } from '../../../services/layout/browser/layoutService.js';

const styleMenu = new MenuId('MyselfInterfaceStyle');
const modernContext = ContextKeyExpr.equals(`config.${LayoutSettings.MODERN_UI}`, true);

for (const [index, option] of [
	{ id: 'classic', enabled: false, title: localize2('interfaceStyle.classic', "Classic") },
	{ id: 'modern', enabled: true, title: localize2('interfaceStyle.modern', "Modern") },
].entries()) {
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: `myself.appearance.${option.id}`,
				title: option.title,
				toggled: ContextKeyExpr.equals(`config.${LayoutSettings.MODERN_UI}`, option.enabled),
				menu: { id: styleMenu, order: index + 1 },
			});
		}

		override run(accessor: ServicesAccessor): Promise<void> {
			// Use the existing setting's target resolution; do not reset fonts, colors or density.
			return accessor.get(IConfigurationService).updateValue(LayoutSettings.MODERN_UI, option.enabled);
		}
	});
}

for (const menu of [MenuId.MenubarAppearanceMenu, MenuId.GlobalActivity]) {
	MenuRegistry.appendMenuItem(menu, {
		title: localize('interfaceStyle', "Interface Style"),
		submenu: styleMenu,
		group: '2_configuration',
		order: 7,
	});
}

// The Settings menu already exposes this shared density menu. Make it reachable
// from View > Appearance as well, with the same checked state and commands.
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	title: localize('layoutDensity', "Layout Density"),
	submenu: LayoutDensityMenu,
	group: '2_configuration',
	order: 8,
	when: modernContext,
});
