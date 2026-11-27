/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { maxChecklistLength, maxNoteLength, ReviewCheck, ReviewNote, ReviewStore, reviewText } from './reviewStore';
import { fingerprint, noteRange, reviewTarget, savedTarget, storedRange } from './reviewTargets';

const viewId = 'myself.localReview';

type ReviewNode =
	| { readonly kind: 'section'; readonly section: 'notes' | 'checklist' }
	| { readonly kind: 'note' | 'check'; readonly id: string };

interface RenderedNote {
	readonly thread: vscode.CommentThread;
	readonly revision: string;
}

function plainBody(text: string): vscode.MarkdownString {
	const body = new vscode.MarkdownString();
	body.isTrusted = false;
	body.supportHtml = false;
	body.supportThemeIcons = false;
	body.appendCodeblock(text, 'plaintext');
	return body;
}

function plainLabel(text: string): string {
	return text.replace(/\s+/gu, ' ').replace(/\$\(/g, '\\$(');
}

function commandNode(value: unknown, kind: 'note' | 'check'): string | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined;
	}
	const item = value as Partial<Extract<ReviewNode, { kind: 'note' | 'check' }>>;
	return item.kind === kind && typeof item.id === 'string' ? item.id : undefined;
}

class LocalReview implements vscode.TreeDataProvider<ReviewNode>, vscode.Disposable {
	private readonly changes = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changes.event;
	private readonly comments = vscode.comments.createCommentController(viewId, vscode.l10n.t('Local Review'));
	private readonly threads = new Map<string, RenderedNote>();
	private readonly threadIds = new WeakMap<vscode.CommentThread, string>();
	private readonly disposables: vscode.Disposable[] = [];
	private disposed = false;

	constructor(private readonly store: ReviewStore) {
		this.disposables.push(
			vscode.window.registerTreeDataProvider(viewId, this),
			vscode.workspace.onDidOpenTextDocument(document => this.refreshThreads(document.uri)),
			vscode.workspace.onDidChangeTextDocument(event => this.refreshThreads(event.document.uri)),
			vscode.workspace.onDidCloseTextDocument(document => this.refreshThreads(document.uri)),
			vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()),
		);
		this.register('open', () => this.open());
		this.register('addNote', () => this.addNote());
		this.register('openNote', arg => this.openNote(arg));
		this.register('editNote', arg => this.editNote(arg));
		this.register('resolveNote', arg => this.setResolved(arg, true));
		this.register('reopenNote', arg => this.setResolved(arg, false));
		this.register('deleteNote', arg => this.deleteNote(arg));
		this.register('addCheck', () => this.addCheck());
		this.register('toggleCheck', arg => this.toggleCheck(arg));
		this.register('deleteCheck', arg => this.deleteCheck(arg));
		this.refresh();
	}

	dispose(): void {
		this.disposed = true;
		this.changes.dispose();
		this.comments.dispose();
		this.threads.clear();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	private register(command: string, handler: (arg?: unknown) => unknown): void {
		this.disposables.push(vscode.commands.registerCommand(`${viewId}.${command}`, handler));
	}

	private get notes(): readonly ReviewNote[] {
		return this.store.state?.notes.filter(note => savedTarget(note)) ?? [];
	}

	getChildren(node?: ReviewNode): ReviewNode[] {
		if (!node) {
			return this.store.state ? [{ kind: 'section', section: 'notes' }, { kind: 'section', section: 'checklist' }] : [];
		}
		if (node.kind !== 'section') {
			return [];
		}
		return node.section === 'notes'
			? this.notes.map(note => ({ kind: 'note', id: note.id }))
			: (this.store.state?.checks ?? []).map(check => ({ kind: 'check', id: check.id }));
	}

	getTreeItem(node: ReviewNode): vscode.TreeItem {
		if (node.kind === 'section') {
			const title = node.section === 'notes' ? vscode.l10n.t('Review Notes') : vscode.l10n.t('Checklist');
			const item = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.Expanded);
			item.id = node.section;
			return item;
		}
		if (node.kind === 'note') {
			const note = this.getNote(node);
			const target = note && savedTarget(note);
			if (note && target) {
				const item = new vscode.TreeItem(plainLabel(note.body).slice(0, 80));
				item.id = note.id;
				item.description = `${vscode.workspace.asRelativePath(target.uri, true)}:${note.range[0] + 1}`;
				item.tooltip = `${target.uri.fsPath}:${note.range[0] + 1}\n${note.body}`;
				item.iconPath = new vscode.ThemeIcon(note.resolved ? 'check' : 'comment');
				item.contextValue = note.resolved ? 'localReviewNoteResolved' : 'localReviewNoteOpen';
				item.command = { command: `${viewId}.openNote`, title: vscode.l10n.t('Open Review Note'), arguments: [node] };
				return item;
			}
		} else {
			const check = this.getCheck(node);
			if (check) {
				const item = new vscode.TreeItem(plainLabel(check.label));
				item.id = check.id;
				item.tooltip = check.label;
				item.iconPath = new vscode.ThemeIcon(check.checked ? 'check' : 'circle-outline');
				item.contextValue = 'localReviewCheck';
				item.command = { command: `${viewId}.toggleCheck`, title: vscode.l10n.t('Toggle Checklist Item'), arguments: [node] };
				return item;
			}
		}
		return new vscode.TreeItem(vscode.l10n.t('Item Unavailable'));
	}

	private getNote(arg: unknown): ReviewNote | undefined {
		let id = commandNode(arg, 'note');
		if (typeof arg === 'object' && arg !== null && !id) {
			const thread = arg as vscode.CommentThread;
			const found = this.threadIds.get(thread);
			if (found && this.threads.get(found)?.thread === thread) {
				id = found;
			}
		}
		return id ? this.notes.find(note => note.id === id) : undefined;
	}

	private getCheck(arg: unknown): ReviewCheck | undefined {
		const id = commandNode(arg, 'check');
		return id ? this.store.state?.checks.find(check => check.id === id) : undefined;
	}

	private refresh(): void {
		if (!this.disposed) {
			this.refreshThreads();
			this.changes.fire();
		}
	}

	private refreshThreads(resource?: vscode.Uri): void {
		if (this.disposed) {
			return;
		}
		const key = resource?.toString();
		const documents = new Map(vscode.workspace.textDocuments.filter(document => !document.isClosed).map(document => [document.uri.toString(), document]));
		const active = new Set<string>();
		for (const note of this.notes) {
			if (key && note.resource !== key) {
				continue;
			}
			const document = documents.get(note.resource);
			const range = noteRange(note);
			if (!document || fingerprint(document, range) !== note.anchor) {
				continue;
			}
			active.add(note.id);
			const previous = this.threads.get(note.id);
			if (previous?.revision === note.revision) {
				continue;
			}
			const comment: vscode.Comment = {
				body: plainBody(note.body),
				mode: vscode.CommentMode.Preview,
				author: { name: vscode.l10n.t('Local Review') },
			};
			const thread = previous?.thread ?? this.comments.createCommentThread(document.uri, range, [comment]);
			thread.canReply = false;
			thread.comments = [comment];
			thread.state = note.resolved ? vscode.CommentThreadState.Resolved : vscode.CommentThreadState.Unresolved;
			thread.contextValue = note.resolved ? 'localReviewNoteResolved' : 'localReviewNoteOpen';
			this.threads.set(note.id, { thread, revision: note.revision });
			this.threadIds.set(thread, note.id);
		}
		for (const [id, { thread }] of this.threads) {
			if ((!key || thread.uri.toString() === key) && !active.has(id)) {
				thread.dispose();
				this.threads.delete(id);
			}
		}
	}

	private async open(): Promise<void> {
		if (!this.store.state) {
			void vscode.window.showWarningMessage(vscode.l10n.t('The saved local review could not be read.'));
		}
		await vscode.commands.executeCommand(`${viewId}.focus`);
	}

	private async commit(update: Promise<boolean>): Promise<void> {
		try {
			if (await update) {
				this.refresh();
			} else if (!this.disposed) {
				void vscode.window.showWarningMessage(vscode.l10n.t('The review changed or reached its item limit. Reopen it and try again.'));
			}
		} catch {
			if (!this.disposed) {
				void vscode.window.showWarningMessage(vscode.l10n.t('The local review could not be saved.'));
			}
		}
	}

	private input(title: string, limit: number, value?: string): Thenable<string | undefined> {
		return vscode.window.showInputBox({
			title, value,
			validateInput: text => reviewText(text, limit) ? undefined : vscode.l10n.t('Enter some text within the {0}-character limit.', limit),
		});
	}

	private async addNote(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		const target = editor && reviewTarget(editor.document.uri);
		if (!editor || !target || editor.document.isClosed) {
			void vscode.window.showInformationMessage(vscode.l10n.t('Open a local workspace file to add a review note.'));
			return;
		}
		const { document } = editor;
		const range = editor.selection.isEmpty ? document.lineAt(editor.selection.active.line).range : editor.selection;
		const anchor = fingerprint(document, range);
		if (!anchor) {
			void vscode.window.showInformationMessage(vscode.l10n.t('Choose a shorter selection for the review note.'));
			return;
		}
		const version = document.version;
		const body = reviewText(await this.input(vscode.l10n.t('Add Local Review Note'), maxNoteLength), maxNoteLength);
		if (!body || this.disposed) {
			return;
		}
		const current = () => !this.disposed && !document.isClosed && document.version === version
			&& reviewTarget(document.uri)?.root === target.root;
		if (!current()) {
			void vscode.window.showInformationMessage(vscode.l10n.t('The file changed while the note was open. Select the range again.'));
			return;
		}
		await this.commit(this.store.addNote({
			id: randomUUID(), revision: randomUUID(), resource: target.resource, root: target.root,
			range: storedRange(range), anchor, body, resolved: false,
		}, current));
	}

	private async openNote(arg: unknown): Promise<void> {
		const note = this.getNote(arg);
		const target = note && savedTarget(note);
		if (!note || !target || this.disposed) {
			return;
		}
		try {
			const document = await vscode.workspace.openTextDocument(target.uri);
			if (this.disposed || !savedTarget(note) || this.getNote(arg)?.revision !== note.revision) {
				return;
			}
			const range = noteRange(note);
			const attached = fingerprint(document, range) === note.anchor;
			await vscode.window.showTextDocument(document, { selection: attached ? range : undefined, preview: false });
			if (!attached) {
				void vscode.window.showInformationMessage(vscode.l10n.t('The saved line context changed. The note is still in Local Review.'));
			}
		} catch {
			void vscode.window.showWarningMessage(vscode.l10n.t('The file for this review note could not be opened.'));
		}
	}

	private async editNote(arg: unknown): Promise<void> {
		const note = this.getNote(arg);
		if (!note || this.disposed) {
			return;
		}
		const body = reviewText(await this.input(vscode.l10n.t('Edit Review Note'), maxNoteLength, note.body), maxNoteLength);
		if (body && body !== note.body && !this.disposed && savedTarget(note)) {
			await this.commit(this.store.changeNote(note, { ...note, body, revision: randomUUID() }));
		}
	}

	private async setResolved(arg: unknown, resolved: boolean): Promise<void> {
		const note = this.getNote(arg);
		if (note && note.resolved !== resolved && !this.disposed) {
			await this.commit(this.store.changeNote(note, { ...note, resolved, revision: randomUUID() }));
		}
	}

	private async deleteNote(arg: unknown): Promise<void> {
		const note = this.getNote(arg);
		if (note && !this.disposed && await this.confirm(vscode.l10n.t('Delete this local review note?')) && !this.disposed && savedTarget(note)) {
			await this.commit(this.store.changeNote(note, undefined));
		}
	}

	private async addCheck(): Promise<void> {
		if (!vscode.workspace.workspaceFolders?.some(folder => reviewTarget(folder.uri))) {
			void vscode.window.showInformationMessage(vscode.l10n.t('Open a local workspace to add checklist items.'));
			return;
		}
		const label = reviewText(await this.input(vscode.l10n.t('Add Review Checklist Item'), maxChecklistLength), maxChecklistLength);
		if (label && !this.disposed && vscode.workspace.workspaceFolders?.some(folder => reviewTarget(folder.uri))) {
			await this.commit(this.store.addCheck({ id: randomUUID(), revision: randomUUID(), label, checked: false }));
		}
	}

	private async toggleCheck(arg: unknown): Promise<void> {
		const check = this.getCheck(arg);
		if (check && !this.disposed) {
			await this.commit(this.store.changeCheck(check, { ...check, checked: !check.checked, revision: randomUUID() }));
		}
	}

	private async deleteCheck(arg: unknown): Promise<void> {
		const check = this.getCheck(arg);
		if (check && !this.disposed && await this.confirm(vscode.l10n.t('Delete this checklist item?')) && !this.disposed) {
			await this.commit(this.store.changeCheck(check, undefined));
		}
	}

	private async confirm(message: string): Promise<boolean> {
		const label = vscode.l10n.t('Delete');
		return await vscode.window.showWarningMessage(message, { modal: true }, label) === label;
	}
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(new LocalReview(new ReviewStore(context.workspaceState)));
}
