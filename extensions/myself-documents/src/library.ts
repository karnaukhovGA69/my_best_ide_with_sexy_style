/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { isRecord } from './document';
import { findLocalLink, LibraryEntry, LibraryGroup, maxDocumentBytes, parseCatalog, safeRelativeFile } from './libraryModel';
import { readDocumentationFolder } from './libraryImport';
import { libraryHtml } from './libraryView';

type LibraryNode = LibraryGroup | LibraryEntry;
const readerViewId = 'myself.documentation.reader';

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
		vscode.window.registerWebviewViewProvider(readerViewId, library, { webviewOptions: { retainContextWhenHidden: true } }),
		vscode.commands.registerCommand('myself.documentation.open', (id: string) => library.open(id)),
		vscode.commands.registerCommand('myself.documentation.search', () => library.search()),
		vscode.commands.registerCommand('myself.documentation.import', () => mutate(() => library.importFile())),
		vscode.commands.registerCommand('myself.documentation.importFolder', () => mutate(() => library.importFolder())),
		vscode.commands.registerCommand('myself.documentation.remove', (entry: LibraryEntry) => mutate(() => library.remove(entry))),
	);
}

class DocumentationLibrary implements vscode.TreeDataProvider<LibraryNode>, vscode.WebviewViewProvider, vscode.Disposable {
	private readonly changes = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changes.event;
	private readonly root: vscode.Uri;
	private readonly loaded: Promise<void>;
	private groups: LibraryGroup[] = [];
	private entries: LibraryEntry[] = [];
	private imports: LibraryEntry[] = [];
	private reader: vscode.WebviewView | undefined;
	private readerListeners: vscode.Disposable | undefined;
	private current: LibraryEntry | undefined;
	private payload: object | undefined;
	private sentPayload: object | undefined;
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
				&& (entry.collection === undefined || (typeof entry.collection === 'string' && /^[a-f0-9-]+$/.test(entry.collection) && typeof entry.importPath === 'string' && safeRelativeFile(entry.importPath)))
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
		if (isEntry(node)) { return []; }
		if (node.id === 'imported') {
			const sets = new Map<string, LibraryGroup>();
			for (const entry of this.imports) {
				if (entry.collection) { sets.set(entry.collection, { id: 'imported-' + entry.collection, title: typeof entry.collectionTitle === 'string' ? entry.collectionTitle : vscode.l10n.t('Documentation'), version: '', license: '' }); }
			}
			return [...this.imports.filter(entry => !entry.collection), ...sets.values()];
		}
		if (node.id.startsWith('imported-')) { return this.imports.filter(entry => entry.collection === node.id.slice('imported-'.length)); }
		return this.entries.filter(entry => entry.group === node.id);
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

	resolveWebviewView(reader: vscode.WebviewView): void {
		if (this.disposed) { return; }
		this.readerListeners?.dispose();
		this.reader = reader;
		this.ready = false;
		this.sentPayload = undefined;
		reader.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media'), vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')],
		};
		this.readerListeners = vscode.Disposable.from(
			reader.webview.onDidReceiveMessage(message => {
				void this.message(message).catch(() => {
					if (this.reader === reader) { void vscode.window.showErrorMessage(vscode.l10n.t('The documentation action could not be completed.')); }
				});
			}),
			reader.onDidChangeVisibility(() => {
				if (reader.visible) { void this.sendDocument(); }
				else { this.generation++; }
			}),
			reader.onDidDispose(() => {
				this.generation++;
				this.reader = undefined;
				this.readerListeners?.dispose();
				this.readerListeners = undefined;
			}),
		);
		reader.webview.html = libraryHtml(reader.webview, this.context.extensionUri);
	}

	private async sendDocument(): Promise<void> {
		const { reader, payload } = this;
		if (!reader?.visible || !this.ready || !payload || this.sentPayload === payload) { return; }
		this.sentPayload = payload;
		if (!await reader.webview.postMessage(payload) && this.reader === reader && this.sentPayload === payload) {
			this.sentPayload = undefined;
		}
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
				notice: vscode.l10n.t('Offline copy. Scripts, forms and external media are disabled.') };
			if (!this.reader?.visible) {
				await vscode.commands.executeCommand(`${readerViewId}.open`, { preserveFocus: true });
			}
			await this.sendDocument();
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
			this.sentPayload = undefined;
			await this.sendDocument();
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


	async importFolder(): Promise<void> {
		await this.loaded;
		if (this.disposed) { return; }
		const selection = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: vscode.l10n.t('Add Documentation Folder') });
		if (this.disposed || !selection?.length) { return; }
		const folder = selection[0];
		if (folder.scheme !== 'file' || folder.authority) { return; }
		const copies: vscode.Uri[] = [];
		try {
			const documents = await readDocumentationFolder(folder.fsPath, () => this.disposed);
			if (!documents.length) { void vscode.window.showInformationMessage(vscode.l10n.t('No HTML, Markdown or text documents were found in this folder.')); return; }
			const collection = randomUUID();
			const collectionTitle = folder.path.split('/').filter(Boolean).pop() || vscode.l10n.t('Documentation');
			const entries: LibraryEntry[] = [];
			await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.context.globalStorageUri, 'imports'));
			for (const document of documents) {
				if (this.disposed) { throw new Error('Cancelled'); }
				const id = randomUUID();
				const format = /\.html?$/i.test(document.relative) ? 'html' : /\.md$/i.test(document.relative) ? 'markdown' : 'text';
				const file = `imports/${id}.${format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'txt'}`;
				const target = vscode.Uri.joinPath(this.context.globalStorageUri, file); copies.push(target);
				await vscode.workspace.fs.writeFile(target, document.bytes);
				entries.push({ id, group: 'imported', title: document.relative, file, source: '', format, collection, collectionTitle, importPath: document.relative });
			}
			if (this.disposed) { throw new Error('Cancelled'); }
			const imported = [...this.imports, ...entries];
			await this.context.globalState.update('documentation.imports', imported);
			this.imports = imported;
			if (!this.disposed) { this.changes.fire(); }
		} catch {
			await Promise.all(copies.map(copy => vscode.workspace.fs.delete(copy).then(undefined, () => undefined)));
			if (!this.disposed) { void vscode.window.showErrorMessage(vscode.l10n.t('The folder could not be added. Use UTF-8 HTML, Markdown or text files up to 16 MiB each, 64 MiB and 5000 documents in total.')); }
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

	dispose(): void {
		this.disposed = true;
		this.generation++;
		this.readerListeners?.dispose();
		this.reader = undefined;
		this.changes.dispose();
	}
}
