/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IWorkbenchContribution } from '../../../common/contributions.js';

/** Keeps the startup registration compatible without creating a broker or accessing MCP services. */
export class McpGatewayToolBrokerContribution implements IWorkbenchContribution { }
