/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IQuickAccessRegistry, Extensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { HelpQuickAccessProvider } from '../../../../platform/quickinput/browser/helpQuickAccess.js';
import { ViewQuickAccessProvider, OpenViewPickerAction, QuickAccessViewPickerAction } from './viewQuickAccess.js';
import { MenuRegistry, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { KeyMod } from '../../../../base/common/keyCodes.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { inQuickPickContext, getQuickNavigateHandler } from '../../../browser/quickaccess.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';

//#region Quick Access Proviers

const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(Extensions.Quickaccess);

quickAccessRegistry.registerQuickAccessProvider({
	ctor: HelpQuickAccessProvider,
	prefix: HelpQuickAccessProvider.PREFIX,
	placeholder: localize('helpQuickAccessPlaceholder', "Type '{0}' to get help on the actions you can take from here.", HelpQuickAccessProvider.PREFIX),
	helpEntries: [{
		description: localize('helpQuickAccess', "Show all Quick Access Providers"),
		commandCenterOrder: 70,
		commandCenterLabel: localize('more', 'More')
	}]
});

quickAccessRegistry.registerQuickAccessProvider({
	ctor: ViewQuickAccessProvider,
	prefix: ViewQuickAccessProvider.PREFIX,
	contextKey: 'inViewsPicker',
	placeholder: localize('viewQuickAccessPlaceholder', "Type the name of a view, output channel or terminal to open."),
	helpEntries: [{ description: localize('viewQuickAccess', "Open View"), commandId: OpenViewPickerAction.ID }]
});


//#endregion


//#region Menu contributions

MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
	group: '1_open',
	command: {
		id: OpenViewPickerAction.ID,
		title: localize({ key: 'miOpenView', comment: ['&& denotes a mnemonic'] }, "&&Open View...")
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '5_infile_nav',
	command: {
		id: 'workbench.action.gotoLine',
		title: localize({ key: 'miGotoLine', comment: ['&& denotes a mnemonic'] }, "Go to &&Line/Column...")
	},
	order: 1
});

//#endregion


//#region Workbench actions and commands

registerAction2(OpenViewPickerAction);
registerAction2(QuickAccessViewPickerAction);

const inViewsPickerContextKey = 'inViewsPicker';
const inViewsPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(inViewsPickerContextKey));
const viewPickerKeybinding = QuickAccessViewPickerAction.KEYBINDING;

const quickAccessNavigateNextInViewPickerId = 'workbench.action.quickOpenNavigateNextInViewPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: quickAccessNavigateNextInViewPickerId,
	weight: KeybindingWeight.WorkbenchContrib + 50,
	handler: getQuickNavigateHandler(quickAccessNavigateNextInViewPickerId, true),
	when: inViewsPickerContext,
	primary: viewPickerKeybinding.primary,
	linux: viewPickerKeybinding.linux,
	mac: viewPickerKeybinding.mac
});

const quickAccessNavigatePreviousInViewPickerId = 'workbench.action.quickOpenNavigatePreviousInViewPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: quickAccessNavigatePreviousInViewPickerId,
	weight: KeybindingWeight.WorkbenchContrib + 50,
	handler: getQuickNavigateHandler(quickAccessNavigatePreviousInViewPickerId, false),
	when: inViewsPickerContext,
	primary: viewPickerKeybinding.primary | KeyMod.Shift,
	linux: viewPickerKeybinding.linux,
	mac: {
		primary: viewPickerKeybinding.mac.primary | KeyMod.Shift
	}
});

//#endregion
