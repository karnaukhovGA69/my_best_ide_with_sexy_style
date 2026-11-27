/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const selectedExtensions = [
	{ id: 'llvm-vs-code-extensions.vscode-clangd', providesLanguageServer: true },
	{ id: 'vscode.cpp', providesLanguageServer: false },
	{ id: 'detachhead.basedpyright', providesLanguageServer: true },
	{ id: 'vscode.python', providesLanguageServer: false },
] as const;

export type SelectedExtension = typeof selectedExtensions[number];

export type InstallationStatus = 'installed' | 'notListed' | 'unavailable';
export type EnablementStatus = 'enabled' | 'disabled' | 'notApplicable' | 'unavailable';
export type ActivationStatus = 'activated' | 'notActivated' | 'notApplicable' | 'unavailable';
export type LanguageServerStatus = 'unverified' | 'notApplicable';

export interface IExtensionActivationEvidence {
	readonly started: boolean;
	readonly succeeded: boolean;
}

interface IInstalledExtensionEvidence {
	readonly enabled: boolean | undefined;
	readonly activation: IExtensionActivationEvidence | undefined;
}

export interface IExtensionDiagnostic {
	readonly extension: SelectedExtension;
	readonly installation: InstallationStatus;
	readonly enablement: EnablementStatus;
	readonly activation: ActivationStatus;
	readonly languageServer: LanguageServerStatus;
}

export function assessExtension(extension: SelectedExtension, evidence: IInstalledExtensionEvidence | 'notListed' | 'unavailable'): IExtensionDiagnostic {
	const languageServer = extension.providesLanguageServer ? 'unverified' : 'notApplicable';
	if (typeof evidence === 'string') {
		const status = evidence === 'notListed' ? 'notApplicable' : 'unavailable';
		return { extension, installation: evidence, enablement: status, activation: status, languageServer };
	}

	let activation: ActivationStatus = 'unavailable';
	if (evidence.activation?.succeeded) {
		activation = 'activated';
	} else if (evidence.activation?.started === false) {
		activation = 'notActivated';
	}

	return {
		extension,
		installation: 'installed',
		enablement: evidence.enabled === undefined ? 'unavailable' : evidence.enabled ? 'enabled' : 'disabled',
		activation,
		languageServer,
	};
}
