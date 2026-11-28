/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { inspectLocalVsixCommand, type ILocalVsixInspection } from '../../../../platform/extensionManagement/common/extensionManagementIpc.js';
import { ISharedProcessService } from '../../../../platform/ipc/electron-browser/services.js';
import { registerLocalVsixSetPreviewAction } from '../browser/localVsixSetPreview.contribution.js';

registerLocalVsixSetPreviewAction(accessor => {
	const sharedProcess = accessor.get(ISharedProcessService);
	return (resource, maxBytes, token) => sharedProcess.getChannel('extensions')
		.call<ILocalVsixInspection | undefined>(inspectLocalVsixCommand, [resource, maxBytes], token);
});
