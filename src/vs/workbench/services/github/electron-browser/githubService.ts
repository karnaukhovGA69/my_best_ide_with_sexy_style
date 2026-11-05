/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { WorkbenchGitHubService } from '../browser/githubService.js';
import { IWorkbenchGitHubService } from '../common/githubService.js';

/** No shared-process clients or credential channel are acquired by the native workbench. */
export class NativeWorkbenchGitHubService extends WorkbenchGitHubService { }

registerSingleton(IWorkbenchGitHubService, NativeWorkbenchGitHubService, InstantiationType.Delayed);
