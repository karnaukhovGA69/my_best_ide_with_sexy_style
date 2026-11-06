/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IToolResult } from '../../common/tools/languageModelToolsService.js';
import { IToolResultCache, IToolResultCompressor, IToolResultFilter } from '../../common/tools/toolResultCompressor.js';

/** Compatibility service; tool results pass through without AI compression or caching. */
export class ToolResultCompressorService extends Disposable implements IToolResultCompressor {
	declare readonly _serviceBrand: undefined;

	registerFilter(_filter: IToolResultFilter): void { }
	registerCache(_cache: IToolResultCache): void { }

	maybeCompress(_toolId: string, _input: unknown, _result: IToolResult): IToolResult | undefined {
		return undefined;
	}
}
