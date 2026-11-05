/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IProcessEnvironment } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import type { INativeMcpDiscoveryData, INativeMcpDiscoveryHelperService } from '../common/nativeMcpDiscoveryHelper.js';

/** Retains main/remote registration without accessing discovery roots or the shell. */
export class NativeMcpDiscoveryHelperService implements INativeMcpDiscoveryHelperService {
	declare readonly _serviceBrand: undefined;

	constructor(_environment?: IProcessEnvironment, _resolveShellEnvironment?: () => Promise<IProcessEnvironment>) {
		// Accept existing desktop arguments without reading or retaining them.
		// The remote default must not capture process.env either.
	}

	async load(): Promise<INativeMcpDiscoveryData> {
		throw new Error(localize('mcpDiscoveryUnavailable', "MCP discovery is not available in this edition of the editor."));
	}
}
