/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';

/** Keeps startup registration compatible without MCP editor providers or service subscriptions. */
export class McpLanguageFeatures extends Disposable implements IWorkbenchContribution { }
