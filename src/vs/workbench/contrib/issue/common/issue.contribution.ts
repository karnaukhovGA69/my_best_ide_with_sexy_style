/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandMetadata } from '../../../../platform/commands/common/commands.js';
import { IssueReporterData, IWorkbenchIssueService } from './issue.js';

const OpenIssueReporterActionId = 'workbench.action.openIssueReporter';
const OpenIssueReporterApiId = 'vscode.openIssueReporter';

const OpenIssueReporterCommandMetadata: ICommandMetadata = {
	description: 'Open the issue reporter and optionally prefill part of the form.',
	args: [
		{
			name: 'options',
			description: 'Data to use to prefill the issue reporter with.',
			isOptional: true,
			schema: {
				oneOf: [
					{
						type: 'string',
						description: 'The extension id to preselect.'
					},
					{
						type: 'object',
						properties: {
							extensionId: {
								type: 'string'
							},
							issueTitle: {
								type: 'string'
							},
							issueBody: {
								type: 'string'
							}
						}

					}
				]
			}
		},
	]
};

interface OpenIssueReporterArgs {
	readonly extensionId?: string;
	readonly issueTitle?: string;
	readonly issueBody?: string;
	readonly extensionData?: string;
}

// Retain command compatibility without installing reporter UI or feedback listeners.
for (const id of [OpenIssueReporterActionId, OpenIssueReporterApiId]) {
	CommandsRegistry.registerCommand({
		id,
		handler: (accessor, args?: string | [string] | OpenIssueReporterArgs) => {
			const data: Partial<IssueReporterData> = typeof args === 'string'
				? { extensionId: args }
				: Array.isArray(args) ? { extensionId: args[0] } : args ?? {};
			return accessor.get(IWorkbenchIssueService).openReporter(data);
		},
		metadata: OpenIssueReporterCommandMetadata
	});
}
