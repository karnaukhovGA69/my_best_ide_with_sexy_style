/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';

/** Retain the commands called by Git without starting AI attribution or edit statistics. */
export class EditTelemetryContribution extends Disposable {
	constructor() {
		super();
		this._register(CommandsRegistry.registerCommand('_aiEdits.hasAiContributions', () => false));
		this._register(CommandsRegistry.registerCommand('_aiEdits.clearAiContributions', () => { }));
		this._register(CommandsRegistry.registerCommand('_aiEdits.clearAllAiContributions', () => { }));
	}
}
