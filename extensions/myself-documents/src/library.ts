/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { isRecord } from './document';
import { findLocalLink, LibraryEntry, LibraryGroup, maxDocumentBytes, parseCatalog, safeRelativeFile } from './libraryModel';
import { libraryHtml } from './libraryView';

type LibraryNode = LibraryGroup | LibraryEntry;
function isEntry(node: LibraryNode): node is LibraryEntry {
	return typeof (node as Partial<LibraryEntry>).file === 'string';
}

export function registerLibrary(context: vscode.ExtensionContext): void {
	const library = new DocumentationLibrary(context);
	let mutations = Promise.resolve();
	const mutate = (operation: () => Promise<void>): Promise<void> => {
		const next = mutations.then(operation);
		mutations = next.catch(() => { });
		return next;
	};
	context.subscriptions.push(library,
		vscode.window.createTreeView('myself.documentation.library', { treeDataProvider: library, showCollapseAll: true }),
		vscode.commands.registerCommand('myself.documentation.open', (id: string) => library.open(id)),
		vscode.commands.registerCommand('myself.documentation.search', () => library.search()),
		vscode.commands.registerCommand('myself.documentation.import', () => mutate(() => library.importFile())),
		vscode.commands.registerCommand('myself.documentation.remove', (entry: LibraryEntry) => mutate(() => library.remove(entry))),
	);
}

class DocumentationLibrary implements vscode.TreeDataProvider<LibraryNode>, vscode.Disposable {
	private readonly changes = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changes.event;
	private readonly root: vscode.Uri;
	private readonly loaded: Promise<void>;
	private groups: LibraryGroup[] = [];
	private entries: LibraryEntry[] = [];
	private imports: LibraryEntry[] = [];
	private panel: vscode.WebviewPanel | undefined;
	private current: LibraryEntry | undefined;
	private payload: object | undefined;
	private ready = false;
	private generation = 0;
	private disposed = false;
	private readonly history: string[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		this.root = vscode.Uri.joinPath(context.extensionUri, 'documentation');
		this.loaded = this.load();
	}

	private async load(): Promise<void> {
		try {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.root, 'catalog.json'));
			if (this.disposed) { return; }
			const catalog = parseCatalog(new TextDecoder().decode(bytes));
			this.groups = catalog.groups;
			this.entries = catalog.entries;
			const imported = this.context.globalState.get<LibraryEntry[]>('documentation.imports', []);
			this.imports = Array.isArray(imported) ? imported.filter(entry => entry?.group === 'imported' && typeof entry.file === 'string' && safeRelativeFile(entry.file)
				&& /^imports\/[a-f0-9-]+\.(html|md|txt)$/.test(entry.file) && typeof entry.id === 'string' && typeof entry.title === 'string'
				&& (entry.format === 'html' || entry.format === 'markdown' || entry.format === 'text')) : [];
		} catch {
			if (!this.disposed) { void vscode.window.showErrorMessage(vscode.l10n.t('The local documentation catalog could not be loaded.')); }
		}
	}

	async getChildren(node?: LibraryNode): Promise<LibraryNode[]> {
		await this.loaded;
		if (this.disposed) { return []; }
		if (!node) {
			return [...this.groups, { id: 'imported', title: vscode.l10n.t('My Documents'), version: '', license: '' }];
		}
		return isEntry(node) ? [] : node.id === 'imported' ? this.imports : this.entries.filter(entry => entry.group === node.id);
	}

	getTreeItem(node: LibraryNode): vscode.TreeItem {
		const item = new vscode.TreeItem(node.title, isEntry(node) ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
		item.id = node.id;
		if (isEntry(node)) {
			item.command = { command: 'myself.documentation.open', title: node.title, arguments: [node.id] };
			item.iconPath = new vscode.ThemeIcon('file-text');
			item.contextValue = node.group === 'imported' ? 'importedDocumentation' : 'bundledDocumentation';
		} else {
			item.iconPath = new vscode.ThemeIcon('book');
			item.description = node.version;
		}
		return item;
	}

	async search(): Promise<void> {
		await this.loaded;
		if (this.disposed) { return; }
		const selected = await vscode.window.showQuickPick([...this.entries, ...this.imports].map(entry => ({ label: entry.title, description: entry.group, id: entry.id })),
			{ placeHolder: vscode.l10n.t('Search local documentation by title'), matchOnDescription: true });
		if (selected) { await this.open(selected.id); }
	}

	async open(id: string, fragment = '', addHistory = true): Promise<void> {
		await this.loaded;
		if (this.disposed) { return; }
		const entry = [...this.entries, ...this.imports].find(entry => entry.id === id);
		if (!entry) { return; }
		const generation = ++this.generation;
		try {
			const uri = vscode.Uri.joinPath(entry.group === 'imported' ? this.context.globalStorageUri : this.root, entry.file);
			if ((await vscode.workspace.fs.stat(uri)).size > maxDocumentBytes) { throw new Error('large'); }
			if (generation !== this.generation) { return; }
			const bytes = await vscode.workspace.fs.readFile(uri);
			if (bytes.length > maxDocumentBytes) { throw new Error('large'); }
			if (generation !== this.generation) { return; }
			if (addHistory && this.current && this.current.id !== entry.id) { this.history.push(this.current.id); }
			this.current = entry;
			const group = this.groups.find(group => group.id === entry.group);
			this.payload = { type: 'document', text: new TextDecoder().decode(bytes), format: /\.md$/i.test(entry.file) ? 'markdown' : entry.format, selector: entry.selector,
				title: entry.title, metadata: [group?.title, group?.version, group?.license].filter(Boolean).join(' · '),
				source: !!entry.source, back: this.history.length > 0, fragment,
				notice: vscode.l10n.t('Offline copy. Scripts, forms and external media are disabled. Use the Find control to search this page.') };
			if (!this.panel) {
				this.ready = false;
				const panel = vscode.window.createWebviewPanel('myself.documentation.reader', entry.title, vscode.ViewColumn.Beside, {
					enableFindWidget: true, enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media'), vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')],
				});
				this.panel = panel;
				const listener = panel.webview.onDidReceiveMessage(message => { void this.message(message).catch(() => vscode.window.showErrorMessage(vscode.l10n.t('The documentation action could not be completed.'))); });
				panel.onDidDispose(() => { listener.dispose(); if (this.panel === panel) { this.generation++; this.panel = undefined; this.ready = false; } });
				panel.webview.html = libraryHtml(panel.webview, this.context.extensionUri);
			}
			this.panel.title = entry.title;
			this.panel.reveal(vscode.ViewColumn.Beside);
			if (this.ready) { await this.panel.webview.postMessage(this.payload); }
		} catch {
			if (generation === this.generation) {
				void vscode.window.showErrorMessage(vscode.l10n.t('The local document could not be read. Files must be UTF-8 text or HTML, up to 16 MiB.'));
			}
		}
	}

	private async message(message: unknown): Promise<void> {
		if (this.disposed || !isRecord(message)) { return; }
		if (message.type === 'ready') {
			this.ready = true;
			if (this.payload) { await this.panel?.webview.postMessage(this.payload); }
		} else if (message.type === 'back') {
			const previous = this.history.pop();
			if (previous) { await this.open(previous, '', false); }
		} else if (message.type === 'source' && this.current?.source && /^https:\/\//.test(this.current.source)) {
			await vscode.env.openExternal(vscode.Uri.parse(this.current.source));
		} else if (message.type === 'link' && typeof message.href === 'string' && this.current) {
			const target = findLocalLink(this.current, message.href, [...this.entries, ...this.imports]);
			if (target) { await this.open(target.entry.id, target.fragment); }
			else {
				let url: URL | undefined;
				try {
					const resolved = new URL(message.href, this.current.source || undefined);
					if (resolved.protocol === 'https:' || resolved.protocol === 'http:') { url = resolved; }
				} catch { /* Missing local files and malformed URLs cannot be opened externally. */ }
				const notice = vscode.l10n.t('This link is not included in the local library.');
				if (!url) { await vscode.window.showInformationMessage(notice); return; }
				const generation = this.generation;
				const open = vscode.l10n.t('Open in Browser');
				const choice = await vscode.window.showInformationMessage(notice, open);
				if (choice === open && generation === this.generation && !this.disposed) {
					await vscode.env.openExternal(vscode.Uri.parse(url.href));
				}
			}
		}
	}

	async importFile(): Promise<void> {
		await this.loaded;
		if (this.disposed) { return; }
		const selection = await vscode.window.showOpenDialog({ canSelectMany: true, filters: { [vscode.l10n.t('Documentation')]: ['html', 'htm', 'md', 'txt'] }, openLabel: vscode.l10n.t('Add to Local Library') });
		if (this.disposed || !selection) { return; }
		for (const uri of selection) {
			if (this.disposed) { return; }
			if (uri.scheme !== 'file' || uri.authority) { continue; }
			let target: vscode.Uri | undefined;
			try {
				if ((await vscode.workspace.fs.stat(uri)).size > maxDocumentBytes) { throw new Error('large'); }
				if (this.disposed) { return; }
				const bytes = await vscode.workspace.fs.readFile(uri);
				if (this.disposed) { return; }
				if (bytes.length > maxDocumentBytes) { throw new Error('large'); }
				new TextDecoder('utf-8', { fatal: true }).decode(bytes);
				const title = uri.path.split('/').pop()!;
				if (!/\.(html?|md|txt)$/i.test(title)) { throw new Error('format'); }
				const format = /\.html?$/i.test(title) ? 'html' : /\.md$/i.test(title) ? 'markdown' : 'text';
				const id = randomUUID();
				const file = `imports/${id}.${format === 'html' ? 'html' : /\.md$/i.test(title) ? 'md' : 'txt'}`;
				target = vscode.Uri.joinPath(this.context.globalStorageUri, file);
				await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.context.globalStorageUri, 'imports'));
				if (this.disposed) { return; }
				await vscode.workspace.fs.writeFile(target, bytes);
				if (this.disposed) {
					await vscode.workspace.fs.delete(target).then(undefined, () => undefined);
					return;
				}
				const entries: LibraryEntry[] = [...this.imports, { id, group: 'imported', title, file, source: '', format }];
				await this.context.globalState.update('documentation.imports', entries);
				this.imports = entries;
				if (!this.disposed) { this.changes.fire(); }
			} catch {
				if (target) { await vscode.workspace.fs.delete(target).then(undefined, () => undefined); }
				if (!this.disposed) { void vscode.window.showErrorMessage(vscode.l10n.t('The document could not be added. Choose a local UTF-8 file up to 16 MiB.')); }
			}
		}
	}

	async remove(candidate: LibraryEntry): Promise<void> {
		await this.loaded;
		if (this.disposed) { return; }
		const entry = this.imports.find(entry => entry.id === candidate?.id);
		if (!entry) { return; }
		const entries = this.imports.filter(item => item !== entry);
		await this.context.globalState.update('documentation.imports', entries);
		this.imports = entries;
		if (!this.disposed) { this.changes.fire(); }
		await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.context.globalStorageUri, entry.file)).then(undefined, () => undefined);
	}

	dispose(): void { this.disposed = true; this.generation++; this.panel?.dispose(); this.changes.dispose(); }
}
