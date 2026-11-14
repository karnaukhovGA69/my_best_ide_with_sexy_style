/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Built-ins shipped by Myself IDE. Programming language support is installed by the user.
 * Use an allowlist so an upstream addition does not silently change the clean distribution.
 * Markdown, configuration editing and Git file formats are application features.
 */
const distributionExtensions = new Set([
	'configuration-editing',
	'debug-auto-launch',
	'debug-server-ready',
	'diff',
	'extension-editing',
	'git',
	'git-base',
	'ipynb',
	'log',
	'markdown-basics',
	'markdown-language-features',
	'markdown-math',
	'merge-conflict',
	'mermaid-markdown-features',
	'microsoft-authentication',
	'myself-documents',
	'notebook-renderers',
	'npm',
	'references-view',
	'search-result',
	'simple-browser',
	'terminal-suggest',
	'theme-abyss',
	'theme-defaults',
	'theme-kimbie-dark',
	'theme-modern-icons',
	'theme-monokai',
	'theme-monokai-dimmed',
	'theme-nerded-calm',
	'theme-quietlight',
	'theme-red',
	'theme-seti',
	'theme-solarized-dark',
	'theme-solarized-light',
	'theme-tomorrow-night-blue',
]);

/** Whether an extension folder belongs in the public distribution. */
export function isDistributionExtension(name: string): boolean {
	return distributionExtensions.has(name);
}

/**
 * Filters paths relative to the packaged extensions directory, including stale build output.
 * Retained extensions bundle their dependencies (or package them within their own folder).
 * The shared TypeScript installation is only needed by the omitted language services.
 * Official documentation is shipped separately from the built-in reader.
 */
export function isDistributionExtensionFile(relativePath: string): boolean {
	const [extension, entry] = relativePath.replaceAll('\\', '/').split('/');
	return isDistributionExtension(extension) && !(extension === 'myself-documents' && entry === 'documentation');
}
