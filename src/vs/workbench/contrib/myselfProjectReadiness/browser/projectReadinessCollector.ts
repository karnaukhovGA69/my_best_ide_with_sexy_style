/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Limiter } from '../../../../base/common/async.js';
import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { Schemas } from '../../../../base/common/network.js';
import { isWindows } from '../../../../base/common/platform.js';
import { joinPath } from '../../../../base/common/resources.js';
import type { URI } from '../../../../base/common/uri.js';
import type { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { FileSystemProviderErrorCode, FileType, toFileSystemProviderErrorCode, type IFileService, type IFileSystemProvider } from '../../../../platform/files/common/files.js';
import { WorkbenchState, type IWorkspaceFolderData } from '../../../../platform/workspace/common/workspace.js';
import type { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import type { ProjectReadinessSnapshot } from '../common/projectReadiness.js';

export const pythonInterpreterKey = 'python.defaultInterpreterPath';

const markers = ['pyproject.toml', 'requirements.txt', '.venv', 'CMakeLists.txt', 'Makefile', 'compile_commands.json'] as const;
type Marker = typeof markers[number];
type FolderSnapshot = ProjectReadinessSnapshot['folders'][number];
type MarkerObservation = NonNullable<FolderSnapshot['markers']>[Marker];

/** Validate the original URI before looking up a provider or interpreting settings. */
function isLocalRoot(uri: URI): boolean {
	return uri.scheme === Schemas.file && !uri.authority && !uri.query && !uri.fragment
		&& isLocalAbsolutePath(uri.path, true) && !uri.path.split('/').some(segment => segment === '.' || segment === '..');
}

/** Recognize only local absolute path syntax. This does not determine mount or file identity. */
function isLocalAbsolutePath(path: string, uriPath = false): boolean {
	if (path.includes('\0') || path.startsWith('//')) {
		return false;
	}
	if (isWindows) {
		return uriPath ? /^\/[a-z]:\//i.test(path) && !path.includes('\\') : /^[a-z]:[/\\]/i.test(path);
	}
	return path.startsWith('/');
}

/** Read only the effective explicit setting for this root. Never expand variables or probe its value. */
function inspectPythonInterpreter(configuration: Pick<IConfigurationService, 'inspect'>, root: URI, workbenchState: WorkbenchState): FolderSnapshot['pythonInterpreter'] {
	const setting = configuration.inspect<unknown>(pythonInterpreterKey, { resource: root });
	const entries = [
		[setting.policyValue, 'unknown'],
		[setting.memoryValue, 'unknown'],
		[setting.workspaceFolderValue, 'workspace-folder'],
		[setting.workspaceValue, 'workspace'],
		[setting.userValue, 'user'],
		[setting.applicationValue, 'unknown'],
	] as const;
	const entry = entries.find(([value]) => value !== undefined);
	if (!entry) {
		return { kind: 'unset' };
	}

	const [value, source] = entry;
	if (source === 'unknown' || value !== setting.value) {
		return { kind: 'unresolved', source: 'unknown' };
	}
	if (typeof value !== 'string' || value !== value.trim() || /[\r\n\0]|%[^%]+%/.test(value)) {
		return { kind: 'unresolved', source };
	}
	if (!value.includes('${') && isLocalAbsolutePath(value)) {
		return { kind: 'absolute', source, presence: 'unknown' };
	}

	const folderScoped = source === 'workspace-folder' || (source === 'workspace' && workbenchState === WorkbenchState.FOLDER);
	const path = isWindows ? value.replaceAll('\\', '/') : value;
	const folderPrefix = '${workspaceFolder}/';
	const relativePath = path.startsWith(folderPrefix) ? path.slice(folderPrefix.length) : path;
	if (folderScoped && (relativePath !== path || relativePath.includes('/') || relativePath === '.venv')
		&& relativePath && !relativePath.startsWith('/') && !relativePath.startsWith('~')
		&& !relativePath.includes(':') && !relativePath.includes('\\') && !relativePath.includes('${')
		&& !relativePath.split('/').includes('..')) {
		return { kind: 'folder-relative', source, baseFolder: root, presence: 'unknown' };
	}
	return { kind: 'unresolved', source };
}

/** Read one fixed entry. Only the provider's explicit not-found error establishes absence. */
async function observeMarker(provider: IFileSystemProvider, root: URI, marker: Marker): Promise<MarkerObservation> {
	try {
		// The disk provider may inspect a symlink target's metadata. Only report the link itself.
		const { type } = await provider.stat(joinPath(root, marker));
		if (type & FileType.SymbolicLink) {
			return 'unverified-link';
		}
		switch (type) {
			case FileType.File: return 'file';
			case FileType.Directory: return 'directory';
			default: return 'unknown';
		}
	} catch (error) {
		return toFileSystemProviderErrorCode(error) === FileSystemProviderErrorCode.FileNotFound ? 'absent' : 'unknown';
	}
}

/** Collect the model snapshot for eligible local roots, with at most four concurrent metadata requests. */
export async function collectProjectReadiness(
	roots: readonly IWorkspaceFolderData[],
	workbenchState: WorkbenchState,
	trust: Pick<IWorkspaceTrustManagementService, 'isWorkspaceTrusted'>,
	files: Pick<IFileService, 'getProvider'>,
	configuration: Pick<IConfigurationService, 'inspect'>,
	token: CancellationToken,
): Promise<ProjectReadinessSnapshot> {
	const isTrusted = trust.isWorkspaceTrusted();
	const folders = roots.filter(root => isLocalRoot(root.uri)).map(({ uri: folder }) => ({
		folder,
		pythonInterpreter: isTrusted && !token.isCancellationRequested ? inspectPythonInterpreter(configuration, folder, workbenchState) : undefined,
	}));
	if (!isTrusted || token.isCancellationRequested || !folders.length) {
		return { isTrusted, folders };
	}

	// Desktop registers its disk provider for file:. FileService.stat and exists
	// would activate providers even when one is already registered.
	const provider = files.getProvider(Schemas.file);
	if (!provider) {
		return { isTrusted, folders };
	}
	const limiter = new Limiter<readonly [Marker, MarkerObservation]>(4);
	try {
		const observed = await Promise.all(folders.map(async ({ folder, pythonInterpreter }): Promise<FolderSnapshot> => {
			const entries = await Promise.all(markers.map(marker => limiter.queue(async () => [
				marker,
				token.isCancellationRequested || !trust.isWorkspaceTrusted() || files.getProvider(Schemas.file) !== provider
					? 'unknown'
					: await observeMarker(provider, folder, marker),
			])));
			return { folder, pythonInterpreter, markers: Object.fromEntries(entries) };
		}));
		return { isTrusted, folders: observed };
	} finally {
		limiter.dispose();
	}
}
