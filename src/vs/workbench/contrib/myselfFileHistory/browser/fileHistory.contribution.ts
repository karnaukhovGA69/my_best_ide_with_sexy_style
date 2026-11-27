/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { safeIntl } from '../../../../base/common/date.js';
import { escapeIcons } from '../../../../base/common/iconLabels.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { language } from '../../../../base/common/platform.js';
import { basename, IExtUri } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ActiveEditorContext, ActiveEditorReadonlyContext, ResourceContextKey, SideBySideEditorActiveContext, TextCompareEditorActiveContext } from '../../../common/contextkeys.js';
import { BINARY_DIFF_EDITOR_ID, EditorResourceAccessor, isSideBySideEditorInput, SaveSourceRegistry } from '../../../common/editor.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkingCopyHistoryService } from '../../../services/workingCopy/common/workingCopyHistory.js';
import { VIEW_ID } from '../../files/common/files.js';
import { LocalHistoryFileSystemProvider } from '../../localHistory/browser/localHistoryFileSystemProvider.js';

const historyMenu = new MenuId('MyselfCurrentFileHistory');
const hasPreview = new RawContextKey<boolean>('myselfFileHistoryHasPreview', false, localize('hasPreview', "Whether the active editor compares a local history entry with its file."));
const normalFile = ContextKeyExpr.and(
	ResourceContextKey.Scheme.isEqualTo(Schemas.file),
	TextCompareEditorActiveContext.negate(),
	ActiveEditorContext.notEqualsTo(BINARY_DIFF_EDITOR_ID),
	SideBySideEditorActiveContext.negate()
);
const localHistoryEnabled = ContextKeyExpr.has('config.workbench.localHistory.enabled');
const restoresInProgress = new Set<string>();

function isLocalFile(uri: URI | undefined): uri is URI {
	return uri?.scheme === Schemas.file && !uri.authority && uri.path.startsWith('/') && !uri.path.startsWith('//') && !uri.fsPath.startsWith('\\\\');
}

function activeFile(editors: IEditorService): URI | undefined {
	const editor = editors.activeEditor;
	if (!editor || editor.isDisposed() || isSideBySideEditorInput(editor)) {
		return undefined;
	}
	const resource = EditorResourceAccessor.getOriginalUri(editor);
	return isLocalFile(resource) ? resource : undefined;
}

function localHistoryPreview(editor: EditorInput | undefined, identity: IExtUri) {
	if (!(editor instanceof DiffEditorInput) || editor.isDisposed()) {
		return undefined;
	}
	const original = editor.original.resource;
	const modified = editor.modified.resource;
	if (original?.scheme !== LocalHistoryFileSystemProvider.SCHEMA || original.authority || !isLocalFile(modified)) {
		return undefined;
	}
	try {
		const { associatedResource, location } = LocalHistoryFileSystemProvider.fromLocalHistoryFileSystem(original);
		if (isLocalFile(associatedResource) && isLocalFile(location) && identity.isEqual(associatedResource, modified)) {
			return { editor, original, modified, location, id: basename(location) };
		}
	} catch {
		// A local-history URI is an untrusted descriptor, even inside a real diff.
	}
	return undefined;
}

export class FileHistoryPreviewContext extends Disposable {
	constructor(
		@IEditorService editors: IEditorService,
		@IContextKeyService contextKeys: IContextKeyService,
		@IUriIdentityService identity: IUriIdentityService,
	) {
		super();
		const key = hasPreview.bindTo(contextKeys);
		const inputListener = this._register(new MutableDisposable());
		const update = () => key.set(Boolean(localHistoryPreview(editors.activeEditor, identity.extUri)));
		const watch = () => {
			const listeners = inputListener.value = new DisposableStore();
			if (editors.activeEditor && !editors.activeEditor.isDisposed()) {
				listeners.add(editors.activeEditor.onDidChangeLabel(update));
				listeners.add(editors.activeEditor.onWillDispose(() => key.set(false)));
			}
			update();
		};
		this._register(editors.onDidActiveEditorChange(watch));
		this._register(toDisposable(() => key.reset()));
		watch();
	}
}

registerWorkbenchContribution2('workbench.contrib.myselfFileHistory', FileHistoryPreviewContext, WorkbenchPhase.AfterRestored);

for (const menu of [
	{ id: MenuId.EditorTitle, when: normalFile },
	{ id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', VIEW_ID) },
]) {
	MenuRegistry.appendMenuItem(menu.id, {
		...menu,
		submenu: historyMenu,
		title: localize('currentFileHistory', "Current File History"),
		icon: Codicon.history,
		group: 'navigation',
		order: 6
	});
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'myself.fileHistory.open',
			title: localize2('openHistory', "Open File Timeline"),
			precondition: normalFile,
			f1: false,
			menu: { id: historyMenu, order: 1 }
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const resource = activeFile(accessor.get(IEditorService));
		if (resource) {
			await accessor.get(ICommandService).executeCommand('files.openTimeline', resource);
		} else {
			accessor.get(INotificationService).info(localize('openFile', "Open a local file to view its history."));
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'myself.fileHistory.preview',
			title: localize2('previewHistory', "Preview Local History…"),
			precondition: ContextKeyExpr.and(normalFile, localHistoryEnabled),
			f1: false,
			menu: { id: historyMenu, order: 2 }
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editors = accessor.get(IEditorService);
		const editor = editors.activeEditor;
		const resource = activeFile(editors);
		if (!resource) {
			accessor.get(INotificationService).info(localize('openFile', "Open a local file to view its history."));
			return;
		}
		const configuration = accessor.get(IConfigurationService);
		if (!configuration.getValue<boolean>('workbench.localHistory.enabled')) {
			accessor.get(INotificationService).info(localize('historyDisabled', "Local history is disabled."));
			return;
		}
		const history = accessor.get(IWorkingCopyHistoryService);
		const identity = accessor.get(IUriIdentityService).extUri;
		const picker = accessor.get(IQuickInputService);
		const commands = accessor.get(ICommandService);
		const notices = accessor.get(INotificationService);
		const current = () => editors.activeEditor === editor && activeFile(editors)?.toString() === resource.toString();
		const entries = (await history.getEntries(resource, CancellationToken.None)).filter(entry =>
			identity.isEqual(entry.workingCopy.resource, resource) && isLocalFile(entry.location)
		);
		if (!current()) {
			return;
		}
		if (!entries.length) {
			notices.info(localize('noHistory', "No local history entries were found for this file."));
			return;
		}
		const formatter = safeIntl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'medium' }).value;
		const selected = await picker.pick([...entries].sort((a, b) => b.timestamp - a.timestamp).map(entry => ({
			entry,
			label: escapeIcons(SaveSourceRegistry.getSourceLabel(entry.source)),
			description: formatter.format(entry.timestamp),
			detail: entry.sourceDescription ? escapeIcons(entry.sourceDescription) : undefined,
		})), { placeHolder: localize('chooseEntry', "Select a local history entry to compare with the current file") });
		if (selected && current() && configuration.getValue<boolean>('workbench.localHistory.enabled')) {
			await commands.executeCommand('workbench.action.localHistory.compareWithFile', { uri: resource, handle: selected.entry.id });
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'myself.fileHistory.restorePreview',
			title: localize2('restorePreview', "Restore Previewed Local Version…"),
			icon: Codicon.history,
			precondition: ContextKeyExpr.and(hasPreview, ActiveEditorReadonlyContext.negate()),
			f1: false,
			menu: { id: MenuId.EditorTitle, when: hasPreview, group: 'navigation', order: 7 }
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editors = accessor.get(IEditorService);
		const identity = accessor.get(IUriIdentityService).extUri;
		const preview = localHistoryPreview(editors.activeEditor, identity);
		if (!preview) {
			return;
		}
		const restoreKey = identity.getComparisonKey(preview.modified);
		if (restoresInProgress.has(restoreKey)) {
			return;
		}
		const history = accessor.get(IWorkingCopyHistoryService);
		const commands = accessor.get(ICommandService);
		const notices = accessor.get(INotificationService);
		restoresInProgress.add(restoreKey);
		try {
			const entries = await history.getEntries(preview.modified, CancellationToken.None);
			const entry = entries.find(entry =>
				entry.id === preview.id &&
				identity.isEqual(entry.location, preview.location) &&
				identity.isEqual(entry.workingCopy.resource, preview.modified)
			);
			const current = localHistoryPreview(editors.activeEditor, identity);
			if (current?.editor !== preview.editor || current.original.toString() !== preview.original.toString() || current.modified.toString() !== preview.modified.toString()) {
				return;
			}
			if (!entry) {
				notices.info(localize('entryUnavailable', "The previewed local history entry is no longer available."));
				return;
			}
			await commands.executeCommand('workbench.action.localHistory.restore', { uri: entry.workingCopy.resource, handle: entry.id });
		} finally {
			restoresInProgress.delete(restoreKey);
		}
	}
});
