/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';

/** Keeps the startup contribution compatible without registering an MCP filesystem provider. */
export class McpResourceFilesystem extends Disposable implements IWorkbenchContribution { }
