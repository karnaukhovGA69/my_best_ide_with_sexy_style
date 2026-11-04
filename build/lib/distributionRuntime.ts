/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Standalone AI applications and workers are not part of the distribution. */
export function isDistributionRuntimeFile(relativePath: string): boolean {
	return !/^vs\/(?:sessions|platform\/(?:agentHost|localTranscription))(?:\/|$)/.test(relativePath.replaceAll('\\', '/'));
}

export const excludedRuntimeDependencies = new Set([
	'@github/copilot-sdk',
	'@vscode/copilot-api',
	'@anthropic-ai/sdk',
	'foundry-local-sdk',
]);

/** Filter package contents as well as stale output from an earlier build. */
export const runtimeDependencyExclusions = [
	...Array.from(excludedRuntimeDependencies, name => `!**/${name}/**`),
	'!**/@github/copilot-sdk-*/**',
];
