/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRenameSymbolTrackerService, NullRenameSymbolTrackerService } from '../../../../editor/browser/services/renameSymbolTrackerService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

// Inline AI rename suggestions are disabled; do not observe editor cursors or retain edited words.
registerSingleton(IRenameSymbolTrackerService, NullRenameSymbolTrackerService, InstantiationType.Delayed);
