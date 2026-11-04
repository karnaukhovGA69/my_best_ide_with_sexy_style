/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { basename } from '../../../../base/common/resources.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { DocumentPdfRequestV1 } from '../../../../platform/documentExport/common/documentExport.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';

// Keep DTO calls separate from editor menu context arguments.
CommandsRegistry.registerCommand('myself.documents.exportPdf', (accessor, request: DocumentPdfRequestV1) => accessor.get(INativeHostService).exportDocumentPdf(request));
registerAction2(class ExportDocumentPdfAction extends Action2 {
	constructor() {
		super({ id: 'myself.documents.exportActiveTextPdf', title: localize2('exportDocumentPdf', 'Export Text as PDF'), icon: Codicon.export,
			menu: [{ id: MenuId.EditorTitle, group: 'navigation', order: 100, when: ContextKeyExpr.equals('resourceExtname', '.txt') }, { id: MenuId.MenubarFileMenu, group: '6_export', order: 1 }] });
	}

	async run(accessor: ServicesAccessor) {
		const model = accessor.get(ICodeEditorService).getActiveCodeEditor()?.getModel();
		if (!model) { throw new Error('Open a text document before exporting PDF.'); }
		const request: DocumentPdfRequestV1 = { version: 1, text: model.getValue(), suggestedFileName: basename(model.uri), page: { size: 'A4', marginMm: 20, fontFamily: 'serif', fontSizePt: 12, lineHeight: 1.5 } };
		return accessor.get(INativeHostService).exportDocumentPdf(request);
	}
});
