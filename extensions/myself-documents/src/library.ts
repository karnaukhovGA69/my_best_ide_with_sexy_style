/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import * as vscode from 'vscode';
import { isRecord } from './document';
import { findLocalLink, LibraryCatalog, LibraryEntry, LibraryGroup, maxCatalogBytes, maxDocumentBytes, parseCatalog, readOfficialDocument, safeRelativeFile } from './libraryModel';
import { readDocumentationFolder } from './libraryImport';
import { libraryHtml } from './libraryView';

type LibraryNode = LibraryGroup | LibraryEntry;
interface CatalogLocation { uri: vscode.Uri; installed: boolean; version?: string }
const readerViewId = 'myself.documentation.reader';
const offlineDocumentationId = 'myself.offline-documentation';

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
	private readonly extensionChanges: vscode.Disposable;
	private catalogLocation: CatalogLocation | undefined;
	private catalogLoad: Promise<void> | undefined;
	private catalog: (LibraryCatalog & { root: string }) | undefined;
	private imports: LibraryEntry[];
	private reader: vscode.WebviewView | undefined;
	private readerListeners: vscode.Disposable | undefined;
	private current: LibraryEntry | undefined;
	private payload: object | undefined;
	private sentPayload = false;
	private sentBack: boolean | undefined;
	private ready = false;
	private generation = 0;
	private disposed = false;
	private history: LibraryEntry[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		const imported = context.globalState.get<LibraryEntry[]>('documentation.imports', []);
		this.imports = Array.isArray(imported) ? imported.filter(entry => entry?.group === 'imported' && typeof entry.file === 'string' && safeRelativeFile(entry.file)
			&& /^imports\/[a-f0-9-]+\.(html|md|txt)$/.test(entry.file) && typeof entry.id === 'string' && typeof entry.title === 'string'
			&& (entry.collection === undefined || (typeof entry.collection === 'string' && /^[a-f0-9-]+$/.test(entry.collection) && typeof entry.importPath === 'string' && safeRelativeFile(entry.importPath)))
			&& (entry.format === 'html' || entry.format === 'markdown' || entry.format === 'text')) : [];
		this.extensionChanges = vscode.extensions.onDidChange(() => this.refreshCatalog());
		this.refreshCatalog();
	}

	private refreshCatalog(): void {
		if (this.disposed) { return; }
		const installed = vscode.extensions.getExtension(offlineDocumentationId);
		const location = { uri: installed?.extensionUri ?? this.context.extensionUri, installed: !!installed, version: installed?.packageJSON.version };
		const previous = this.catalogLocation;
		if (previous?.installed === location.installed && previous.version === location.version && previous.uri.toString() === location.uri.toString()) { return; }
		this.catalogLocation = location;

		// The old snapshot must stop accepting navigation as soon as the registered extension changes.
		const hadCatalog = !!this.catalog;
		this.catalog = undefined;
		this.history = this.history.filter(entry => entry.group === 'imported');
		if (this.current && this.current.group !== 'imported') {
			this.current = undefined;
			this.payload = { type: 'clear' };
			this.sentPayload = false;
		}
		this.catalogLoad = this.loadCatalog(location);
		if (hadCatalog) { this.changes.fire(); }
		void this.sendDocument();
	}

	private async loadCatalog(location: CatalogLocation): Promise<void> {
		try {
			if (location.uri.scheme !== 'file' || location.uri.authority) { throw new Error('Documentation must be local'); }
			const root = await realpath(location.uri.fsPath);
			if (this.disposed || this.catalogLocation !== location) { return; }
			const catalog = parseCatalog(await readOfficialDocument(root, 'catalog.json', maxCatalogBytes));
			if (this.disposed || this.catalogLocation !== location) { return; }
			const importedIds = new Set(this.imports.map(entry => entry.id));
			if (catalog.entries.some(entry => importedIds.has(entry.id)) || catalog.groups.some(group => importedIds.has(group.id))) { throw new Error('Invalid documentation entry'); }
			this.catalog = { ...catalog, root };
		} catch (error) {
			// Development and transition builds may still carry the original built-in snapshot.
			if (!this.disposed && this.catalogLocation === location && (location.installed || error.code !== 'ENOENT')) {
				void vscode.window.showErrorMessage(vscode.l10n.t('The local documentation catalog could not be loaded.'));
			}
		} finally {
			if (!this.disposed && this.catalogLocation === location) { this.changes.fire(); }
		}
	}

	getChildren(node?: LibraryNode): LibraryNode[] {
		if (this.disposed) { return []; }
		if (!node) {
			return [...(this.catalog?.groups ?? []), { id: 'imported', title: vscode.l10n.t('My Documents'), version: '', license: '' }];
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
		return this.catalog?.entries.filter(entry => entry.group === node.id) ?? [];
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
		if (this.disposed) { return; }
		const catalog = this.catalog;
		const selected = await vscode.window.showQuickPick([...(catalog?.entries ?? []), ...this.imports].map(entry => ({ label: entry.title, description: entry.group, entry })),
			{ placeHolder: vscode.l10n.t('Search local documentation by title'), matchOnDescription: true });
		if (selected && (selected.entry.group === 'imported' ? this.imports.includes(selected.entry) : this.catalog === catalog)) {
			await this.open(selected.entry.id);
		}
	}

	resolveWebviewView(reader: vscode.WebviewView): void {
		if (this.disposed) { return; }
		this.readerListeners?.dispose();
		this.reader = reader;
		this.ready = false;
		this.sentPayload = false;
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
		if (!reader?.visible || !this.ready || !payload) { return; }
		const back = this.history.length > 0;
		const newDocument = !this.sentPayload;
		if (!newDocument && this.sentBack === back) { return; }
		this.sentPayload = true;
		this.sentBack = back;
		const message = newDocument ? { ...payload, back } : { type: 'backState', back };
		if (!await reader.webview.postMessage(message) && this.reader === reader && this.payload === payload) {
			if (newDocument) { this.sentPayload = false; }
			else if (this.sentBack === back) { this.sentBack = undefined; }
		}
	}

	async open(id: string, fragment = '', addHistory = true): Promise<void> {
		if (this.disposed) { return; }
		const imported = this.imports.find(entry => entry.id === id);
		let catalog = this.catalog;
		let entry = imported ?? catalog?.entries.find(entry => entry.id === id);
		if (!entry && catalog) { return; }
		const generation = ++this.generation;
		if (!entry) {
			const load = this.catalogLoad;
			await load;
			if (this.disposed || load !== this.catalogLoad || generation !== this.generation) { return; }
			catalog = this.catalog;
			entry = catalog?.entries.find(entry => entry.id === id);
			if (!entry) { return; }
		}
		const isCurrent = () => generation === this.generation && (imported ? this.imports.includes(imported) : this.catalog === catalog);
		try {
			let text: string;
			if (imported) {
				const uri = vscode.Uri.joinPath(this.context.globalStorageUri, entry.file);
				if ((await vscode.workspace.fs.stat(uri)).size > maxDocumentBytes) { throw new Error('large'); }
				if (!isCurrent()) { return; }
				const bytes = await vscode.workspace.fs.readFile(uri);
				if (bytes.length > maxDocumentBytes) { throw new Error('large'); }
				text = new TextDecoder().decode(bytes);
			} else {
				text = await readOfficialDocument(catalog!.root, entry.file, maxDocumentBytes);
			}
			if (!isCurrent()) { return; }
			if (addHistory && this.current && this.current.id !== entry.id && (this.current.group !== 'imported' || this.imports.includes(this.current))) {
				this.history.push(this.current);
			}
			this.current = entry;
			this.sentPayload = false;
			const group = catalog?.groups.find(group => group.id === entry.group);
			this.payload = { type: 'document', text, format: /\.md$/i.test(entry.file) ? 'markdown' : entry.format, selector: entry.selector,
				title: entry.title, metadata: [group?.title, group?.version, group?.license].filter(Boolean).join(' · '),
				source: !!entry.source, fragment,
				notice: vscode.l10n.t('Offline copy. Scripts, forms and external media are disabled.') };
			if (!this.reader?.visible) {
				await vscode.commands.executeCommand(`${readerViewId}.open`, { preserveFocus: true });
			}
			await this.sendDocument();
		} catch {
			if (isCurrent()) {
				void vscode.window.showErrorMessage(vscode.l10n.t('The local document could not be read. Files must be UTF-8 text or HTML, up to 16 MiB.'));
			}
		}
	}

	private async message(message: unknown): Promise<void> {
		if (this.disposed || !isRecord(message)) { return; }
		if (message.type === 'ready') {
			this.ready = true;
			this.sentPayload = false;
			await this.sendDocument();
		} else if (message.type === 'back') {
			const previous = this.history.pop();
			if (previous) {
				await this.open(previous.id, '', false);
				await this.sendDocument();
			}
		} else if (message.type === 'source' && this.current?.source && /^https:\/\//.test(this.current.source)) {
			await vscode.env.openExternal(vscode.Uri.parse(this.current.source));
		} else if (message.type === 'link' && typeof message.href === 'string' && this.current) {
			const current = this.current;
			const target = findLocalLink(current, message.href, [...(this.catalog?.entries ?? []), ...this.imports]);
			if (target) { await this.open(target.entry.id, target.fragment); }
			else {
				let url: URL | undefined;
				try {
					const resolved = new URL(message.href, current.source || undefined);
					if (resolved.protocol === 'https:' || resolved.protocol === 'http:') { url = resolved; }
				} catch { /* Missing local files and malformed URLs cannot be opened externally. */ }
				const notice = vscode.l10n.t('This link is not included in the local library.');
				if (!url) { await vscode.window.showInformationMessage(notice); return; }
				const generation = this.generation;
				const open = vscode.l10n.t('Open in Browser');
				const choice = await vscode.window.showInformationMessage(notice, open);
				if (choice === open && generation === this.generation && this.current === current && !this.disposed) {
					await vscode.env.openExternal(vscode.Uri.parse(url.href));
				}
			}
		}
	}

	async importFile(): Promise<void> {
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
		if (this.disposed) { return; }
		const entry = this.imports.find(entry => entry.id === candidate?.id);
		if (!entry) { return; }
		const entries = this.imports.filter(item => item !== entry);
		await this.context.globalState.update('documentation.imports', entries);
		this.imports = entries;
		this.history = this.history.filter(item => item !== entry);
		if (!this.disposed) { this.changes.fire(); }
		await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.context.globalStorageUri, entry.file)).then(undefined, () => undefined);
		await this.sendDocument();
	}

	dispose(): void {
		this.disposed = true;
		this.generation++;
		this.extensionChanges.dispose();
		this.readerListeners?.dispose();
		this.reader = undefined;
		this.changes.dispose();
	}
}
