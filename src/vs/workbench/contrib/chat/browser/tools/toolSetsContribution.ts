/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isFalsyOrEmpty } from '../../../../../base/common/arrays.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { isFalsyOrWhitespace } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType, isObject } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { IWorkbenchContribution } from '../../../../common/contributions.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { ILanguageModelToolsService, IToolData, IToolSet, isToolSet, ToolAndToolSetEnablementMap } from '../../common/tools/languageModelToolsService.js';
import { IRawToolSetContribution } from '../../common/tools/languageModelToolsContribution.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { isValidBasename } from '../../../../../base/common/extpath.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { parse } from '../../../../../base/common/jsonc.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ChatViewId, IChatWidgetService } from '../chat.js';
import { ChatContextKeys } from '../../common/actions/chatContextKeys.js';

export abstract class RawToolSetsShape {

	static readonly suffix = '.toolsets.jsonc';

	static isToolSetFileName(uri: URI): boolean {
		return basename(uri).endsWith(RawToolSetsShape.suffix);
	}

	static from(data: unknown, logService: ILogService) {
		if (!isObject(data)) {
			throw new Error(`Invalid tool set data`);
		}

		const map = new Map<string, Exclude<IRawToolSetContribution, 'name'>>();

		for (const [name, value] of Object.entries(data as RawToolSetsShape)) {

			if (isFalsyOrWhitespace(name)) {
				logService.error(`Tool set name cannot be empty`);
			}
			if (isFalsyOrEmpty(value.tools)) {
				logService.error(`Tool set '${name}' cannot have an empty tools array`);
			}

			map.set(name, {
				name,
				tools: value.tools,
				description: value.description,
				icon: value.icon,
			});
		}

		return new class extends RawToolSetsShape { }(map);
	}

	entries: ReadonlyMap<string, Exclude<IRawToolSetContribution, 'name'>>;

	private constructor(entries: Map<string, Exclude<IRawToolSetContribution, 'name'>>) {
		this.entries = Object.freeze(new Map(entries));
	}
}

/** Compatibility contribution; user AI tool sets are not loaded or watched automatically. */
export class UserToolSetsContributions extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'chat.userToolSets';
}

export interface IConfigureToolSetsOptions {
	readonly selection?: ToolAndToolSetEnablementMap;
}

function getSelectionFromArg(arg: unknown): ToolAndToolSetEnablementMap | undefined {
	if (!isObject(arg)) {
		return undefined;
	}

	const selection = (arg as IConfigureToolSetsOptions).selection;
	if (!(selection instanceof ToolAndToolSetEnablementMap)) {
		return undefined;
	}

	return selection;
}

export function getEnabledSelectionReferences(selection: ToolAndToolSetEnablementMap, toolsService: ILanguageModelToolsService): string[] {
	const enabledToolSets: IToolSet[] = [];
	const enabledTools: IToolData[] = [];

	for (const [item, enabled] of selection) {
		if (!enabled) {
			continue;
		}

		if (isToolSet(item)) {
			// Only serialize a tool set when none of its member tools are explicitly
			// unchecked in the selection. A partially-deselected tool set would otherwise
			// silently re-enable the deselected member tools, matching the guard in
			// `toFullReferenceNames`. Members absent from the map inherit the tool set's state.
			if (Iterable.every(item.getTools(), tool => selection.get(tool) !== false)) {
				enabledToolSets.push(item);
			}
		} else {
			enabledTools.push(item);
		}
	}

	const coveredToolIds = new Set<string>();
	for (const toolSet of enabledToolSets) {
		for (const tool of toolSet.getTools()) {
			coveredToolIds.add(tool.id);
		}
	}

	const references: string[] = [];
	const seen = new Set<string>();
	const addReference = (referenceName: string) => {
		if (seen.has(referenceName)) {
			return;
		}
		seen.add(referenceName);
		references.push(referenceName);
	};

	for (const toolSet of enabledToolSets) {
		addReference(toolsService.getFullReferenceName(toolSet));
	}

	for (const tool of enabledTools) {
		if (coveredToolIds.has(tool.id)) {
			continue;
		}
		// `getFullReferenceName` already returns the qualified `toolSet/tool` name for tools
		// that belong to a non-user tool set, even when the tool is not independently
		// referenceable in prompts. Only include the tool when the reference round-trips, which
		// filters out orphan tools that cannot be referenced at all.
		const referenceName = toolsService.getFullReferenceName(tool);
		if (toolsService.getToolByFullReferenceName(referenceName) !== tool) {
			continue;
		}
		addReference(referenceName);
	}

	return references;
}

export function createToolSetFileContents(toolSetName: string, toolReferences: readonly string[]): string {
	const serializedReferences = toolReferences.map(reference => `\t\t\t${JSON.stringify(reference)}`).join(',\n');

	return [
		'{',
		`\t${JSON.stringify(toolSetName)}: {`,
		'\t\t"tools": [',
		serializedReferences,
		'\t\t],',
		'\t\t"description": "",',
		'\t\t"icon": "tools"',
		'\t}',
		'}',
	].join('\n');
}

export function deleteToolSetFromFileContents(rawContents: string, toolSetName: string): { contents: string; isEmpty: boolean } | undefined {
	const parsed = parse(rawContents);
	if (!isObject(parsed)) {
		return undefined;
	}

	const record = parsed as Record<string, unknown>;
	if (!Object.hasOwn(record, toolSetName)) {
		return undefined;
	}

	delete record[toolSetName];
	return { contents: JSON.stringify(record, undefined, '\t'), isEmpty: Object.keys(record).length === 0 };
}

// ---- actions

export class ConfigureToolSets extends Action2 {

	static readonly ID = 'chat.configureToolSets';

	constructor() {
		super({
			id: ConfigureToolSets.ID,
			title: localize2('chat.configureToolSets', 'Configure Tool Sets...'),
			shortTitle: localize('chat.configureToolSets.short', "Tool Sets"),
			category: CHAT_CATEGORY,
			f1: true,
			precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.Tools.toolsCount.greater(0)),
			menu: [{
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals('view', ChatViewId)),
				order: 11,
				group: '2_level'
			}],
		});
	}

	override async run(accessor: ServicesAccessor, options?: IConfigureToolSetsOptions): Promise<void> {

		const toolsService = accessor.get(ILanguageModelToolsService);
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);
		const userDataProfileService = accessor.get(IUserDataProfileService);
		const fileService = accessor.get(IFileService);
		const textFileService = accessor.get(ITextFileService);
		const chatWidgetService = accessor.get(IChatWidgetService);

		const picks: (IQuickPickItem & { toolset?: IToolSet; kind: 'createFromSelection' | 'createNewFile' | 'existing' })[] = [];
		// When the command is invoked without an explicit selection (e.g. from F1 or the chat
		// view title menu), fall back to the tool selection of the active chat widget.
		const currentSelection = getSelectionFromArg(options)
			?? chatWidgetService.lastFocusedWidget?.input.selectedToolsModel.entriesMap.get()
			?? ToolAndToolSetEnablementMap.fromEntries([]);
		const selectedReferences = getEnabledSelectionReferences(currentSelection, toolsService);

		if (selectedReferences.length > 0) {
			picks.push({
				label: localize('chat.configureToolSets.createFromCurrentSelection', "Create from current selection..."),
				kind: 'createFromSelection',
				alwaysShow: true,
				iconClass: ThemeIcon.asClassName(Codicon.plus)
			});
		}

		picks.push({
			label: localize('chat.configureToolSets.add', 'Create new tool sets file...'),
			kind: 'createNewFile',
			alwaysShow: true,
			iconClass: ThemeIcon.asClassName(Codicon.plus)
		});

		for (const toolSet of toolsService.toolSets.get()) {
			if (toolSet.source.type !== 'user') {
				continue;
			}

			picks.push({
				label: toolSet.referenceName,
				kind: 'existing',
				toolset: toolSet,
				tooltip: toolSet.description,
				iconClass: ThemeIcon.asClassName(toolSet.icon)
			});
		}

		const pick = await quickInputService.pick(picks, {
			canPickMany: false,
			placeHolder: localize('chat.configureToolSets.placeholder', 'Select a tool set to configure'),
		});

		if (!pick) {
			return; // user cancelled
		}

		let resource: URI | undefined;

		if (!pick.toolset) {

			const name = await quickInputService.input({
				placeHolder: localize('input.placeholder', "Type tool sets file name"),
				validateInput: async (input) => {
					if (!input) {
						return localize('bad_name1', "Invalid file name");
					}
					if (!isValidBasename(input)) {
						return localize('bad_name2', "'{0}' is not a valid file name", input);
					}
					if (pick.kind === 'createFromSelection') {
						const candidate = joinPath(userDataProfileService.currentProfile.promptsHome, `${input}${RawToolSetsShape.suffix}`);
						if (await fileService.exists(candidate)) {
							return localize('chat.configureToolSets.fileAlreadyExists', "A file with this name already exists");
						}
					}
					return undefined;
				}
			});

			if (isFalsyOrWhitespace(name)) {
				return; // user cancelled
			}

			resource = joinPath(userDataProfileService.currentProfile.promptsHome, `${name}${RawToolSetsShape.suffix}`);

			if (pick.kind === 'createFromSelection') {
				const toolSetName = await quickInputService.input({
					placeHolder: localize('toolSetName.placeholder', "Type new tool set name"),
					validateInput: async (input) => {
						if (isFalsyOrWhitespace(input)) {
							return localize('toolSetName.bad_name', "Tool set name cannot be empty");
						}
						return undefined;
					}
				});

				if (!toolSetName || isFalsyOrWhitespace(toolSetName)) {
					return;
				}

				await textFileService.write(resource, createToolSetFileContents(toolSetName, selectedReferences));
			} else if (!await fileService.exists(resource)) {
				await textFileService.write(resource, [
					'// Place your tool sets here...',
					'// Example:',
					'// {',
					'// \t"toolSetName": {',
					'// \t\t"tools": [',
					'// \t\t\t"someTool",',
					'// \t\t\t"anotherTool"',
					'// \t\t],',
					'// \t\t"description": "description",',
					'// \t\t"icon": "tools"',
					'// \t}',
					'// }',
				].join('\n'));
			}

		} else {
			assertType(pick.toolset.source.type === 'user');
			resource = pick.toolset.source.file;
		}

		await editorService.openEditor({ resource, options: { pinned: true } });
	}
}
