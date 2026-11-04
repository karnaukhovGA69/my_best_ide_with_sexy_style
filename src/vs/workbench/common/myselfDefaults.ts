/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../platform/registry/common/platform.js';
import { Extensions, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';

// Keep extension APIs available while starting with a quiet, minimal workbench.
Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerDefaultConfigurations([{
	overrides: {
		'chat.disableAIFeatures': true,
		'chat.copilotCliCommand.enabled': false,
		'chat.allowAnonymousAccess': false,
		'chat.mcp.access': 'none',
		'chat.agent.enabled': false,
		'workbench.startupEditor': 'none',
		'workbench.secondarySideBar.defaultVisibility': 'hidden',
		'workbench.tips.enabled': false,
		'editor.stickyScroll.enabled': false,
		'editor.snippetSuggestions': 'none',
		'editor.tabCompletion': 'off',
		'update.mode': 'none',
		'update.showReleaseNotes': false,
		'telemetry.telemetryLevel': 'off',
		'workbench.enableExperiments': false,
	}
}]);
