/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseActionViewItem } from '../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IObservable } from '../../../../../base/common/observable.js';
import { MenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { IMenuEntryActionViewItemOptions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';

/** Inactive compatibility view: voice controls are unavailable in this distribution. */
export class DictationActionViewItem extends BaseActionViewItem {
	constructor(action: MenuItemAction, _options: IMenuEntryActionViewItemOptions | undefined, _isActive: IObservable<boolean>) {
		super(undefined, action);
	}

	override render(_container: HTMLElement): void { }
	override isEnabled(): boolean { return false; }
	override onClick(): void { }
}
