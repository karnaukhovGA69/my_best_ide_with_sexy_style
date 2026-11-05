/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Keep the existing Node DI registration/import path, using the same inert API
// as the web extension host. There is no child process, env-file or HTTP adapter.
export { ExtHostMcpService as NodeExtHostMpcService } from '../common/extHostMcp.js';
