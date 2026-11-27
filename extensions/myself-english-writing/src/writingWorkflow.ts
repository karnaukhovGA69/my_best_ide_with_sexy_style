/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const writingCommands = {
	problems: 'myself.englishWriting.problems',
	codeActions: 'myself.englishWriting.codeActions',
	analyzeText: 'myself.englishWriting.analyzeText',
	tools: 'myself.englishWriting.tools',
} as const;

const harperId = 'elijah-potter.harper';
const textAnalyzerId = 'iglou-eu.text-analyzer';
const openTextAnalyzer = 'textAnalyzer.openPanel';
const editorCommands = {
	problems: 'workbench.actions.view.problems',
	codeActions: 'editor.action.quickFix',
	analyzeText: openTextAnalyzer,
} as const;

type Action = keyof typeof writingCommands;
type CommandAction = keyof typeof editorCommands;

interface ExtensionRegistration {
	readonly id: string;
	readonly extensionUri: { readonly scheme: string; readonly authority: string };
	readonly packageJSON: unknown;
}

interface WritingWindow {
	activeLanguage(): string | undefined;
	getExtension(id: string): ExtensionRegistration | undefined;
	executeCommand(command: string): PromiseLike<unknown>;
}

type WritingResult =
	| { readonly kind: 'unsupported-editor' | 'missing-analyzer' | 'dispatched' }
	| { readonly kind: 'command-failed'; readonly action: CommandAction }
	| { readonly kind: 'tools'; readonly harper: boolean; readonly analyzer: boolean };

/** Require the expected local extension registration and command contribution before dispatch. */
function hasTextAnalyzer(window: WritingWindow): boolean {
	const extension = window.getExtension(textAnalyzerId);
	if (extension?.id.toLowerCase() !== textAnalyzerId || extension.extensionUri.scheme !== 'file' || extension.extensionUri.authority) {
		return false;
	}
	const manifest = extension.packageJSON as { contributes?: { commands?: readonly { command?: unknown }[] } } | null | undefined;
	const commands = manifest?.contributes?.commands;
	return Array.isArray(commands) && commands.some(entry => entry?.command === openTextAnalyzer);
}

/** Use the active text editor at invocation and pass no document or edit arguments. */
export async function runWritingAction(action: Action, window: WritingWindow): Promise<WritingResult> {
	const language = window.activeLanguage();
	if (language !== 'markdown' && language !== 'plaintext') {
		return { kind: 'unsupported-editor' };
	}
	if (action === 'tools') {
		return {
			kind: 'tools',
			harper: window.getExtension(harperId)?.id.toLowerCase() === harperId,
			analyzer: hasTextAnalyzer(window),
		};
	}
	if (action === 'analyzeText' && !hasTextAnalyzer(window)) {
		return { kind: 'missing-analyzer' };
	}
	try {
		await window.executeCommand(editorCommands[action]);
		return { kind: 'dispatched' };
	} catch {
		return { kind: 'command-failed', action };
	}
}
