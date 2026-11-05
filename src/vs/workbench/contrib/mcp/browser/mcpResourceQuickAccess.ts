/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { DefaultQuickAccessFilterValue, IQuickAccessProvider, IQuickAccessProviderRunOptions } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickPick, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IMcpServer } from '../common/mcpTypes.js';

/** Compatibility entry point for the remaining MCP browse command. */
export class McpResourceQuickPick {
	constructor(_scopeTo: IMcpServer | undefined) { }

	public async pick(_token = CancellationToken.None): Promise<void> {
		// The command does not await this method; finish without opening UI or rejecting.
	}
}

/** Compatibility provider until the shared MCP quick access registration is removed. */
export class McpResourceQuickAccess implements IQuickAccessProvider {
	public static readonly PREFIX = 'mcpr ';

	defaultFilterValue = DefaultQuickAccessFilterValue.LAST;

	provide(picker: IQuickPick<IQuickPickItem, { useSeparators: true }>, _token: CancellationToken, _runOptions?: IQuickAccessProviderRunOptions): IDisposable {
		picker.items = [];
		picker.busy = false;
		return Disposable.None;
	}
}
