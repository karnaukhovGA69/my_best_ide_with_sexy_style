/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { compareIgnoreCase } from '../../../../base/common/strings.js';
import type { ILocalExtension } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionIdentifier, ExtensionType } from '../../../../platform/extensions/common/extensions.js';
import type { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import type { InstallationDiagnosticsProfileTracker } from '../../myselfDiagnostics/browser/installationDiagnosticsReader.js';

type CachedLocalExtension = Pick<ILocalExtension, 'identifier' | 'location' | 'isWorkspaceScoped' | 'type'> & Partial<Pick<ILocalExtension, 'size'>>;

interface ICachedInventory {
	readonly whenInitialized: IExtensionsWorkbenchService['whenInitialized'];
	readonly installed: readonly { readonly local?: CachedLocalExtension }[];
}

type ProfileInventory = Pick<InstallationDiagnosticsProfileTracker, 'revision' | 'profileName' | 'inventoryStatus'>;

interface IExtensionSize {
	readonly id: string;
	readonly builtIn: boolean;
	readonly size: number | undefined;
}

interface IExtensionResourceSnapshot {
	readonly revision: number;
	readonly profileName: string;
	readonly entries: readonly IExtensionSize[];
}

function displayText(value: string): string {
	return value.replace(/[\s\p{Cc}\p{Bidi_Control}]+/gu, ' ').trim().slice(0, 160);
}

export async function readExtensionResources(profile: ProfileInventory, inventory: ICachedInventory): Promise<IExtensionResourceSnapshot | undefined> {
	const revision = profile.revision;
	try {
		await inventory.whenInitialized;
		if (profile.revision !== revision || profile.inventoryStatus !== 'available') {
			return undefined;
		}

		const entries = new Map<string, IExtensionSize>();
		for (const { local } of inventory.installed) {
			if (!local || local.location.scheme !== Schemas.file || local.location.authority || local.isWorkspaceScoped) {
				continue;
			}
			const key = ExtensionIdentifier.toKey(local.identifier.id);
			if (!entries.has(key)) {
				entries.set(key, {
					id: displayText(local.identifier.id),
					builtIn: local.type === ExtensionType.System,
					size: local.size !== undefined && Number.isSafeInteger(local.size) && local.size > 0 ? local.size : undefined,
				});
			}
		}
		return {
			revision,
			profileName: displayText(profile.profileName),
			entries: [...entries.values()].sort((a, b) => compareIgnoreCase(a.id, b.id)),
		};
	} catch {
		return undefined;
	}
}
