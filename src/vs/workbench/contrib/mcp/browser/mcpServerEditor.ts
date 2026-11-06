/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, Dimension, size } from '../../../../base/browser/dom.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import type { IWebview } from '../../webview/browser/webview.js';

/** Keeps restored MCP editor inputs readable without loading server details or webviews. */
export class McpServerEditor extends EditorPane {
	static readonly ID = 'workbench.editor.mcpServer';

	private message: HTMLElement | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
	) {
		super(McpServerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const message = this.message = append(parent, $('div', { role: 'document', tabIndex: 0 }));
		message.textContent = localize('mcpEditor.unavailable', 'MCP servers are not available in this edition of the editor.');
		message.style.padding = '20px';
		message.style.boxSizing = 'border-box';
		message.style.overflow = 'auto';
		this._register(toDisposable(() => {
			message.remove();
			this.message = undefined;
		}));
	}

	override focus(): void {
		super.focus();
		this.message?.focus();
	}

	layout(dimension: Dimension): void {
		if (this.message) {
			size(this.message, dimension.width, dimension.height);
		}
	}

	get activeWebview(): IWebview | undefined { return undefined; }

	showFind(): void { }

	runFindAction(_previous: boolean): void { }
}
