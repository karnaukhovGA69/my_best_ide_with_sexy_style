/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../../base/common/uri.js';

export const IChatTransferService = createDecorator<IChatTransferService>('chatTransferService');

export interface IChatTransferService {
	readonly _serviceBrand: undefined;

	checkAndSetTransferredWorkspaceTrust(): Promise<void>;
	addWorkspaceToTransferred(workspace: URI): void;
}

/** Compatibility service; AI transfers do not record destinations or change workspace trust. */
export class ChatTransferService implements IChatTransferService {
	declare readonly _serviceBrand: undefined;

	addWorkspaceToTransferred(_workspace: URI): void { }

	async checkAndSetTransferredWorkspaceTrust(): Promise<void> { }
}
