/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigBasedExtensionTip, IExecutableBasedExtensionTip, IExtensionTipsService } from './extensionManagement.js';

/** No filesystem, executable discovery or background recommendation work. */
export class NullExtensionTipsService implements IExtensionTipsService {
	declare readonly _serviceBrand: undefined;

	async getConfigBasedTips(): Promise<IConfigBasedExtensionTip[]> { return []; }
	async getImportantExecutableBasedTips(): Promise<IExecutableBasedExtensionTip[]> { return []; }
	async getOtherExecutableBasedTips(): Promise<IExecutableBasedExtensionTip[]> { return []; }
}
