/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { MenuId, MenuRegistry, isIMenuItem } from '../../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorExtensions } from '../../../../common/editor.js';
import { EditorPaneRegistry } from '../../../../browser/editor.js';
import '../../browser/nps.contribution.js';
import '../../browser/languageSurveys.contribution.js';
import '../../browser/survey.contribution.js';

suite('Removed built-in surveys', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('does not expose developer or extension-triggered survey commands', () => {
		assert.strictEqual(CommandsRegistry.getCommand('workbench.action.openSurvey'), undefined);
		assert.strictEqual(CommandsRegistry.getCommand('_workbench.action.openCopilotSurvey'), undefined);
	});
	test('does not register a survey editor', () => {
		const registry = Registry.as<EditorPaneRegistry>(EditorExtensions.EditorPane);
		assert.ok(registry instanceof EditorPaneRegistry);
		assert.strictEqual(registry.getEditorPaneByType('workbench.editor.survey'), undefined);
	});
	test('does not offer the survey command in the palette', () => {
		assert.strictEqual(MenuRegistry.getMenuItems(MenuId.CommandPalette).some(item => isIMenuItem(item) && item.command.id === 'workbench.action.openSurvey'), false);
	});
});
