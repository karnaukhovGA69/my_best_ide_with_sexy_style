/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserMcpGatewayService } from '../browser/mcpGatewayService.js';

/** Keeps the desktop service registration compatible with the disabled gateway implementation. */
export class WorkbenchMcpGatewayService extends BrowserMcpGatewayService { }
