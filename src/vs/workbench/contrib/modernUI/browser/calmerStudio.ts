/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow } from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IAuxiliaryWindowService } from '../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { isCalmerStudio, IWorkbenchLayoutService, LayoutSettings } from '../../../services/layout/browser/layoutService.js';
import './media/calmerStudio.css';

export const CALMER_STUDIO_CLASS = 'calmer-studio';

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	id: 'workbench',
	type: 'object',
	properties: {
		[LayoutSettings.CALMER_STUDIO]: {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.WINDOW,
			description: localize('calmerStudio', "Use the Calmer Studio layout with flat tabs and compact, unified surfaces."),
		},
	},
});

/** Only applies geometry; profile defaults and explicit preset actions choose colors and settings. */
export class CalmerStudioContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.calmerStudio';
	private enabled: boolean;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IAuxiliaryWindowService private readonly auxiliaryWindowService: IAuxiliaryWindowService,
	) {
		super();
		this.enabled = isCalmerStudio(configurationService);
		for (const container of layoutService.containers) {
			this.apply(container, this.enabled);
		}
		this._register(layoutService.onDidAddContainer(({ container }) => this.apply(container, this.enabled)));
		this._register(configurationService.onDidChangeConfiguration(event => {
			if (!event.affectsConfiguration(LayoutSettings.CALMER_STUDIO) && !event.affectsConfiguration(LayoutSettings.MODERN_UI)) {
				return;
			}
			const enabled = isCalmerStudio(this.configurationService);
			if (this.enabled === enabled) {
				return;
			}
			this.enabled = enabled;
			for (const container of layoutService.containers) {
				this.apply(container, enabled);
			}
			layoutService.layout();
			for (const container of layoutService.containers) {
				if (container !== layoutService.mainContainer) {
					this.auxiliaryWindowService.getWindow(getWindow(container).vscodeWindowId)?.layout();
				}
			}
		}));
	}

	private apply(container: HTMLElement, enabled: boolean): void {
		container.classList.toggle(CALMER_STUDIO_CLASS, enabled);
	}

	override dispose(): void {
		for (const container of this.layoutService.containers) {
			this.apply(container, false);
		}
		super.dispose();
	}
}

registerWorkbenchContribution2(CalmerStudioContribution.ID, CalmerStudioContribution, WorkbenchPhase.BlockRestore);
