/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { runWritingAction, writingCommands } from './writingWorkflow.js';

/** Register the visible editor actions on demand. */
export function activate(context: vscode.ExtensionContext): void {
	const window = {
		activeLanguage: () => vscode.window.activeTextEditor?.document.languageId,
		getExtension: (id: string) => vscode.extensions.getExtension(id),
		executeCommand: (id: string) => vscode.commands.executeCommand(id),
	};
	const actions = Object.keys(writingCommands) as (keyof typeof writingCommands)[];
	for (const action of actions) {
		context.subscriptions.push(vscode.commands.registerCommand(writingCommands[action], async () => {
			const result = await runWritingAction(action, window);
			switch (result.kind) {
				case 'unsupported-editor':
					void vscode.window.showInformationMessage(vscode.l10n.t("Open a Markdown or plain-text document to use English Writing."));
					break;
				case 'missing-analyzer':
					void vscode.window.showInformationMessage(vscode.l10n.t("Text Analyzer is unavailable in this window. Enable it, or use Extensions (…) → Install from VSIX… with a local Text Analyzer VSIX."));
					break;
				case 'command-failed': {
					const errors = {
						problems: vscode.l10n.t("Could not open Problems."),
						codeActions: vscode.l10n.t("Could not open Code Actions."),
						analyzeText: vscode.l10n.t("Could not open Text Analyzer."),
					};
					void vscode.window.showWarningMessage(errors[result.action]);
					break;
				}
				case 'tools': {
					const available = vscode.l10n.t("available");
					const unavailable = vscode.l10n.t("unavailable");
					const status = vscode.l10n.t("Harper — {0}. Text Analyzer — {1}. Availability reflects extension registration.", result.harper ? available : unavailable, result.analyzer ? available : unavailable);
					const help = result.harper && result.analyzer
						? ''
						: vscode.l10n.t("Enable missing tools, or use Extensions (…) → Install from VSIX… with a local VSIX.");
					void vscode.window.showInformationMessage([status, help].filter(Boolean).join(' '));
					break;
				}
			}
		}));
	}
}
