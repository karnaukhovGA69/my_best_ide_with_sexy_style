/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AccessibleViewType } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

/** Compatibility registration for the removed MCP configuration form. */
export class McpServerConfigurationFormAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 115;
	readonly name = 'mcp-server-configuration-form';
	readonly type = AccessibleViewType.Help;
	readonly when = ContextKeyExpr.false();

	getProvider(_accessor: ServicesAccessor): undefined {
		return undefined;
	}
}
