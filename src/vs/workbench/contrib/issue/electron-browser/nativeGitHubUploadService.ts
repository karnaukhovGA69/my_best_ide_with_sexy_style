/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserGitHubUploadService } from '../browser/githubUploadService.js';

// Keep the native registration compatible without native-host or network access.
export class NativeGitHubUploadService extends BrowserGitHubUploadService { }
