/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IMcpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import { McpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifestService.js';

export { McpGalleryManifestService };

registerSingleton(IMcpGalleryManifestService, McpGalleryManifestService, InstantiationType.Delayed);
