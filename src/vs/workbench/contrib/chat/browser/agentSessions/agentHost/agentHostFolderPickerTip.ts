/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IActionWidgetDropdownListOptionsProvider } from '../../../../../../platform/actionWidget/browser/actionWidgetDropdown.js';
import type { IStorageService } from '../../../../../../platform/storage/common/storage.js';

export const FOLDER_PICKER_TIP_DISMISSED_STORAGE_KEY = 'chat.agentHost.folderPickerTipDismissed1';
export const FOLDER_PICKER_TIP_LEARN_MORE_URL = 'https://aka.ms/vscodeMultirootWorkspaceChatFolderPicker';
export const FOLDER_PICKER_TIP_CLASS = 'agent-host-folder-picker-tip';

/** Compatibility options without built-in guidance or persistence. */
export function createFolderPickerTip(_storageService: IStorageService): IActionWidgetDropdownListOptionsProvider {
	return { getListOptions: () => ({ widgetClassName: FOLDER_PICKER_TIP_CLASS }) };
}
