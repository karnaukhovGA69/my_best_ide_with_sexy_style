/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { isWindows } from '../../../../base/common/platform.js';
import type { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, type IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import type { IConfigurationValue } from '../../../../platform/configuration/common/configuration.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { WorkbenchState } from '../../../../platform/workspace/common/workspace.js';

export const pythonInterpreterSetting = 'python.defaultInterpreterPath';

/** Check the registered Python setting without activating its extension. */
export function supportsFolderInterpreterSetting(): boolean {
	const property = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties()[pythonInterpreterSetting];
	return !!property && typeof property.source === 'object' && property.source.id.toLowerCase() === 'ms-python.python'
		&& property.scope === ConfigurationScope.MACHINE_OVERRIDABLE && property.type === 'string';
}

/** Only accept absolute local URI syntax. Mount locality is a property of the OS. */
export function isLocalPath(resource: URI): boolean {
	const { scheme, authority, query, fragment, path } = resource;
	return scheme === Schemas.file && !authority && !query && !fragment
		&& path.startsWith('/') && !path.startsWith('//') && !path.includes('\0')
		&& (!isWindows || (/^\/[a-z]:\//i.test(path) && !path.includes('\\') && !path.slice(3).includes(':')))
		&& !path.split('/').some(segment => segment === '.' || segment === '..');
}

/** Save exactly the picker path as a literal, without forwarding substitution syntax. */
export function interpreterPath(resource: URI): string | undefined {
	if (!isLocalPath(resource) || resource.path.endsWith('/') || /[\p{Cc}\p{Bidi_Control}]|\$\{|%[^%]+%/u.test(resource.path)) {
		return undefined;
	}
	return resource.fsPath;
}

export interface InterpreterSettingSnapshot {
	readonly current: unknown;
	readonly scope: 'policy' | 'session' | 'folder' | 'workspace' | 'user' | 'application' | 'default' | 'unknown';
	readonly folderValue: unknown;
	readonly overridden: boolean;
}

/** Capture the effective and destination values separately for the confirmation. */
export function snapshotInterpreterSetting(setting: IConfigurationValue<unknown>, state: WorkbenchState): InterpreterSettingSnapshot {
	const folderValue = state === WorkbenchState.FOLDER && setting.workspaceValue !== undefined ? setting.workspaceValue : setting.workspaceFolderValue;
	const layers = [
		[setting.policyValue, 'policy'],
		[setting.memoryValue, 'session'],
		[folderValue, 'folder'],
		[state === WorkbenchState.WORKSPACE ? setting.workspaceValue : undefined, 'workspace'],
		[setting.userValue, 'user'],
		[setting.applicationValue, 'application'],
		[setting.defaultValue, 'default'],
	] as const;
	const current = setting.value;
	const layer = layers.find(([value]) => value !== undefined);
	return {
		current,
		scope: layer && Object.is(layer[0], current) ? layer[1] : 'unknown',
		folderValue,
		overridden: setting.policyValue !== undefined || setting.memoryValue !== undefined,
	};
}

/** Display setting values as plain, single-line text in a local confirmation. */
function describeValue(value: unknown): string {
	if (typeof value === 'string') {
		return JSON.stringify(value).replaceAll(/[\p{Bidi_Control}\u2028\u2029]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
	}
	return value === undefined
		? localize('interpreterUnset', "Unset")
		: localize('interpreterOtherValue', "Non-text value");
}

/** Describe the old and new scopes and the exact persisted value. */
export function describeInterpreterChange(setting: InterpreterSettingSnapshot, path: string, folder: URI): string {
	const scopes: Record<InterpreterSettingSnapshot['scope'], string> = {
		policy: localize('scopePolicy', "System Policy"),
		session: localize('scopeSession', "Current Session"),
		folder: localize('scopeFolder', "Folder Settings"),
		workspace: localize('scopeWorkspace', "Workspace Settings"),
		user: localize('scopeUser', "User Settings"),
		application: localize('scopeApplication', "Application Settings"),
		default: localize('scopeDefault', "Default"),
		unknown: localize('scopeUnknown', "Unknown Source"),
	};
	return [
		localize('previewFolder', "Project Folder — {0}", describeValue(folder.fsPath)),
		localize('previewCurrent', "Current Value ({0}) — {1}", scopes[setting.scope], describeValue(setting.current)),
		localize('previewDestination', "Destination — Folder Settings (.vscode/settings.json)"),
		localize('previewSet', "{0}\n{1} → {2}", pythonInterpreterSetting, describeValue(setting.folderValue), describeValue(path)),
		localize('previewSelection', "The Python extension uses this value for its initial choice and keeps any interpreter it has already selected."),
	].join('\n\n');
}
