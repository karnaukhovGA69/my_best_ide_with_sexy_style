/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AccessibleViewRegistry } from '../../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { MenuId, MenuRegistry, isIMenuItem } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { EditorExtensionsRegistry } from '../../../../../editor/browser/editorExtensions.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { CompletionItemKind, CompletionTriggerKind } from '../../../../../editor/common/languages.js';
import { LanguageFeaturesService } from '../../../../../editor/common/services/languageFeaturesService.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { provideSuggestionItems } from '../../../../../editor/contrib/suggest/browser/suggest.js';
import { SuggestController } from '../../../../../editor/contrib/suggest/browser/suggestController.js';
import { InlineCompletionsController } from '../../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js';
// Import the modules used by editor.all and workbench.common.main, plus a shared
// consumer of the command definitions, to catch accidental side-effect bindings.
import '../../../../../editor/contrib/inlineCompletions/browser/inlineCompletions.contribution.js';
import '../../../../../editor/contrib/inlineCompletions/browser/controller/commands.js';
import '../../browser/inlineCompletions.contribution.js';

suite('Myself IDE inline completion distribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const isInlineCommand = (id: string) => id.startsWith('editor.action.inlineSuggest.');

	test('does not install the inline controller or accessible-view runtime', () => {
		assert.deepStrictEqual({
			controller: EditorExtensionsRegistry.getEditorContributions().some(item => item.id === InlineCompletionsController.ID),
			accessibleView: AccessibleViewRegistry.getImplementations().some(item => item.name === 'inline-completions'),
			suggest: EditorExtensionsRegistry.getEditorContributions().some(item => item.id === SuggestController.ID),
		}, { controller: false, accessibleView: false, suggest: true });
	});

	test('does not register inline actions, menus, or side-effect keybindings', () => {
		assert.deepStrictEqual({
			commands: [...CommandsRegistry.getCommands().keys()].filter(isInlineCommand),
			keys: KeybindingsRegistry.getDefaultKeybindings().filter(item => isInlineCommand(item.command ?? '')).map(item => item.command),
			menus: [MenuId.CommandPalette, MenuId.InlineSuggestionToolbar, MenuId.EditorContext].flatMap(menu => MenuRegistry.getMenuItems(menu)).flatMap(item => isIMenuItem(item) && isInlineCommand(item.command.id) ? [item.command.id] : []),
		}, { commands: [], keys: [], menus: [] });
	});

	test('keeps ordinary completion commands and their keyboard bindings', () => {
		const ids = ['editor.action.triggerSuggest', 'acceptSelectedSuggestion', 'hideSuggestWidget'];
		assert.deepStrictEqual(ids.map(id => ({
			command: !!CommandsRegistry.getCommand(id),
			key: KeybindingsRegistry.getDefaultKeybindings().some(item => item.command === id)
		})), ids.map(() => ({ command: true, key: true })));
	});

	test('resolves a method after a dot without requesting a generative inline completion', async () => {
		const features = new LanguageFeaturesService();
		const model = store.add(createTextModel('value.'));
		let inlineCalls = 0;
		let completionCalls = 0;
		store.add(features.inlineCompletionsProvider.register('*', {
			provideInlineCompletions: () => { inlineCalls++; return { items: [] }; },
			disposeInlineCompletions: () => { },
		}));
		store.add(features.completionProvider.register('*', {
			_debugDisplayName: 'ordinary language completion',
			triggerCharacters: ['.'],
			provideCompletionItems: (_model, position, context) => {
				completionCalls++;
				assert.deepStrictEqual(context, { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: '.' });
				return { suggestions: [{ label: 'method', insertText: 'method()', kind: CompletionItemKind.Method, range: Range.fromPositions(position) }] };
			},
			resolveCompletionItem: item => ({ ...item, detail: 'method(): string' }),
		}));
		const suggestions = await provideSuggestionItems(features.completionProvider, model, new Position(1, 7), undefined, {
			triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: '.'
		});
		store.add(suggestions.disposable);
		await suggestions.items[0].resolve(CancellationToken.None);
		assert.deepStrictEqual({
			items: suggestions.items.map(item => ({ label: item.completion.label, kind: item.completion.kind, detail: item.completion.detail })),
			completionCalls, inlineCalls,
		}, { items: [{ label: 'method', kind: CompletionItemKind.Method, detail: 'method(): string' }], completionCalls: 1, inlineCalls: 0 });
	});
});
