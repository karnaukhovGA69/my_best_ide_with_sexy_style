/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IChannelServer } from '../../../base/parts/ipc/common/ipc.js';
import { McpGalleryManifestService } from './mcpGalleryManifestService.js';

/** Accepts legacy manifest notifications without enabling the gallery or waiting for a client. */
export class McpGalleryManifestIPCService extends McpGalleryManifestService {

	constructor(server: IChannelServer<unknown>) {
		super();
		server.registerChannel('mcpGalleryManifest', {
			listen: () => Event.None,
			call: async <T>(_context: unknown, command: string): Promise<T> => {
				if (command === 'setMcpGalleryManifest') {
					return undefined as T;
				}
				throw new Error('Invalid call');
			}
		});
	}
}
