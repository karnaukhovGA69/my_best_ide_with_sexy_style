/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { compare, type SemVer } from '../../../../base/common/semver/semver.js';
import { ExtensionIdentifier, ExtensionType, isApplicationScopedExtension } from '../../../../platform/extensions/common/extensions.js';
import { ExtensionState, type IExtension } from '../../extensions/common/extensions.js';
import { parsePinnedVsixVersion } from '../common/localVsixSet.js';

export type LocalVsixVersionComparison = { readonly kind: 'unknown' }
	| { readonly kind: 'exact' | 'equalPrecedence' | 'newer' | 'older'; readonly installedVersion: string };

function comparePrecedence(file: SemVer, installed: SemVer): number {
	if (file.compareMain(installed) === 0) {
		const firstDifference = file.prerelease.findIndex((part, index) => part !== installed.prerelease[index]);
		const filePart = file.prerelease[firstDifference];
		const installedPart = installed.prerelease[firstDifference];
		// The bundled SemVer comparator casts long numeric identifiers to Number.
		// When the parser kept both identifiers as numeric strings, compare them without rounding.
		if (typeof filePart === 'string' && typeof installedPart === 'string' && /^\d+$/.test(filePart) && /^\d+$/.test(installedPart)) {
			return BigInt(filePart) < BigInt(installedPart) ? -1 : 1;
		}
	}
	return compare(file, installed);
}

export function compareLocalVsixVersion(
	id: string,
	fileVersion: string,
	installed: readonly Pick<IExtension, 'local' | 'state'>[],
): LocalVsixVersionComparison {
	const matches = installed.filter(extension => extension.local && ExtensionIdentifier.toKey(extension.local.identifier.id) === id);
	const [match] = matches;
	const local = match?.local;
	if (matches.length !== 1 || !local || match.state !== ExtensionState.Installed) {
		return { kind: 'unknown' };
	}
	const { location, manifest } = local;
	if (local.type !== ExtensionType.User || !local.isValid || local.isBuiltin || local.isWorkspaceScoped || local.isApplicationScoped
		|| isApplicationScopedExtension(manifest) || location.scheme !== Schemas.file || !location.path.startsWith('/')
		|| location.authority || location.query || location.fragment) {
		return { kind: 'unknown' };
	}
	const current = parsePinnedVsixVersion(manifest.version);
	const selected = parsePinnedVsixVersion(fileVersion);
	if (!current || !selected) {
		return { kind: 'unknown' };
	}
	const installedVersion = manifest.version;
	if (fileVersion === installedVersion) {
		return { kind: 'exact', installedVersion };
	}
	const order = comparePrecedence(selected, current);
	return { kind: order > 0 ? 'newer' : order < 0 ? 'older' : 'equalPrecedence', installedVersion };
}
