/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { EditorAction2 } from '../../../../../editor/browser/editorExtensions.js';
import { IEditorContribution } from '../../../../../editor/common/editorCommon.js';
import { localize2 } from '../../../../../nls.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';

export class EditorDictationStartAction extends EditorAction2 {
	static readonly ID = 'workbench.action.editorDictation.start';

	constructor() {
		super({
			id: EditorDictationStartAction.ID,
			title: localize2('startDictation', "Start Dictation in Editor"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	override async runEditorCommand(_accessor: ServicesAccessor, _editor: ICodeEditor): Promise<void> { }
}

export class EditorDictationStopAction extends EditorAction2 {
	static readonly ID = 'workbench.action.editorDictation.stop';

	constructor() {
		super({
			id: EditorDictationStopAction.ID,
			title: localize2('stopDictation', "Stop Dictation in Editor"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	override runEditorCommand(_accessor: ServicesAccessor, _editor: ICodeEditor): void { }
}

/** Inactive adapter for explicit SCM/comment editor contribution lists. */
export class EditorDictation extends Disposable implements IEditorContribution {
	static readonly ID = 'editorDictation';

	static get(_editor: ICodeEditor): EditorDictation | null {
		return null;
	}

	constructor(_editor: ICodeEditor) {
		super();
	}

	isInProgress(): boolean { return false; }
	async start(): Promise<void> { }
	stop(): void { }
}
