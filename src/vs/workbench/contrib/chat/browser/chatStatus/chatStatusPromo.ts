/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ITooltipWithCommands } from '../../../../services/statusbar/browser/statusbar.js';

/** Compatibility surface for status entries; model promotions are disabled. */
export class ChatStatusPromo extends Disposable {
	readonly onDidChange = Event.None;

	getEntryProps(_visible: boolean): { showPip: boolean; ariaLabel: string; tooltip: ITooltipWithCommands } | undefined {
		return undefined;
	}
}
