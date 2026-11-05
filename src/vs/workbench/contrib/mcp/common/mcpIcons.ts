/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ILogger } from '../../../../platform/log/common/log.js';
import { Dto } from '../../../services/extensions/common/proxyIdentifier.js';
import { IMcpIcons, McpServerLaunch } from './mcpTypes.js';
import { MCP } from './modelContextProtocol.js';

const enum IconTheme {
	Light,
	Dark,
	Any,
}

interface IIcon {
	/** URI the image can be loaded from */
	src: URI;
	/** Theme for this icon. */
	theme: IconTheme;
	/** Sizes of the icon in ascending order. */
	sizes: { width: number; height: number }[];
}

export type ParsedMcpIcons = IIcon[];
export type StoredMcpIcons = Dto<IIcon>[];


/** MCP-provided icon URLs are unavailable, including persisted metadata. */
export function parseAndValidateMcpIcon(_icons: MCP.Icons, _launch: McpServerLaunch, _logger: ILogger): ParsedMcpIcons {
	return [];
}

export class McpIcons implements IMcpIcons {
	public static fromStored(_icons: StoredMcpIcons | undefined): McpIcons {
		return new McpIcons();
	}

	public static fromParsed(_icons: ParsedMcpIcons | undefined): McpIcons {
		return new McpIcons();
	}

	protected constructor() { }

	getUrl(_size: number): { dark: URI; light?: URI } | undefined {
		return undefined;
	}
}
