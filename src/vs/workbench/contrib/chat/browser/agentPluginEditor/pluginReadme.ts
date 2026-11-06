/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../../base/common/network.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../../platform/files/common/files.js';
import { AgentPluginItemKind, IAgentPluginItem } from './agentPluginItems.js';

export interface IPluginReadme {
	readonly content: string;
	readonly baseUri: URI;
}

/** Read already-local documentation without downloading it or contacting a remote provider. */
export async function loadPluginReadme(item: IAgentPluginItem, fileService: Pick<IFileService, 'readFile'>): Promise<IPluginReadme | undefined> {
	const readmeUri = item.kind === AgentPluginItemKind.Installed
		? joinPath(item.plugin.uri, 'README.md')
		: item.readmeUri;
	if (!readmeUri || readmeUri.authority || (readmeUri.scheme !== Schemas.file && readmeUri.scheme !== Schemas.vscodeUserData)) {
		return undefined;
	}
	try {
		const content = await fileService.readFile(readmeUri);
		return { content: content.value.toString(), baseUri: readmeUri };
	} catch (error) {
		if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
			return undefined;
		}
		throw error;
	}
}
