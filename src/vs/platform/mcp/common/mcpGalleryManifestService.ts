/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IMcpGalleryManifest, IMcpGalleryManifestService, McpGalleryManifestStatus } from './mcpGalleryManifest.js';

/** Keeps existing MCP consumers compatible without enabling a gallery in this product. */
export class McpGalleryManifestService extends Disposable implements IMcpGalleryManifestService {

	declare readonly _serviceBrand: undefined;

	readonly mcpGalleryManifestStatus = McpGalleryManifestStatus.Unavailable;
	readonly onDidChangeMcpGalleryManifest = Event.None;
	readonly onDidChangeMcpGalleryManifestStatus = Event.None;

	async getMcpGalleryManifest(): Promise<IMcpGalleryManifest | null> {
		return null;
	}

	async getDefaultMcpGalleryManifest(): Promise<IMcpGalleryManifest | null> {
		return null;
	}
}
