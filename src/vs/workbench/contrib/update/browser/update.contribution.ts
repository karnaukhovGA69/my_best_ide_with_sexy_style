/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { showReleaseNotesInEditor } from './update.js';
import product from '../../../../platform/product/common/product.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ShowCurrentReleaseNotesActionId, ShowCurrentReleaseNotesFromCurrentFileActionId } from '../common/update.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ReleaseNotesAccessibilityHelp } from './releaseNotesAccessibilityHelp.js';

// Only explicit release notes actions remain. No update UI or startup work is registered.

// Release notes

AccessibleViewRegistry.register(new ReleaseNotesAccessibilityHelp());

export class ShowReleaseNotesAction extends Action2 {

	static readonly AVAILABLE = true;

	constructor() {
		super({
			id: ShowCurrentReleaseNotesActionId,
			title: {
				...localize2('showReleaseNotes', "Show Release Notes"),
				mnemonicTitle: localize({ key: 'mshowReleaseNotes', comment: ['&& denotes a mnemonic'] }, "Show &&Release Notes"),
			},
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			menu: [{
				id: MenuId.MenubarHelpMenu,
				group: '1_welcome',
				order: 5,
			}]
		});
	}

	async run(accessor: ServicesAccessor, version?: string): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const productService = accessor.get(IProductService);
		await showReleaseNotesInEditor(instantiationService, version ?? productService.version, false);
	}
}

export class ShowCurrentReleaseNotesFromCurrentFileAction extends Action2 {

	constructor() {
		super({
			id: ShowCurrentReleaseNotesFromCurrentFileActionId,
			title: {
				...localize2('showReleaseNotesCurrentFile', "Open Current File as Release Notes"),
				mnemonicTitle: localize({ key: 'mshowLocalReleaseNotes', comment: ['&& denotes a mnemonic'] }, "Open Current File as &&Release Notes"),
			},
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			menu: [{ id: MenuId.MenubarHelpMenu, group: '1_welcome', order: 6 }],
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const productService = accessor.get(IProductService);

		try {
			await showReleaseNotesInEditor(instantiationService, productService.version, true);
		} catch (err) {
			throw new Error(localize('releaseNotesFromFileNone', "Open a local Markdown file before viewing it as release notes."));
		}
	}
}

if (ShowReleaseNotesAction.AVAILABLE) {
	registerAction2(ShowReleaseNotesAction);
}
registerAction2(ShowCurrentReleaseNotesFromCurrentFileAction);
