/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMenuItem, MenuId } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, ContextKeyExpression } from '../../../../platform/contextkey/common/contextkey.js';
import { UpdateTitleBarContext } from '../common/update.js';

// Preserve the existing menu-placement contract without registering an updater UI.
let additionalMenuPlacement: { readonly menuId: MenuId; readonly item: Omit<IMenuItem, 'command'> } | undefined;

export function registerUpdateTitleBarMenuPlacement(menuId: MenuId, item: Omit<IMenuItem, 'command'> = {}): void {
	if (additionalMenuPlacement) {
		throw new Error('An additional update title bar menu placement is already registered');
	}
	additionalMenuPlacement = { menuId, item };
}

export function getAdditionalUpdateTitleBarMenuWhen(when?: ContextKeyExpression): ContextKeyExpression {
	return ContextKeyExpr.and(UpdateTitleBarContext, when)!;
}
