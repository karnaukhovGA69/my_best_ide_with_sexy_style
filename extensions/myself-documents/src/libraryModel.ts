/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface LibraryEntry {
	id: string;
	group: string;
	title: string;
	file: string;
	source: string;
	format: 'html' | 'markdown' | 'text';
	selector?: string;
	collection?: string;
	collectionTitle?: string;
	importPath?: string;
}

export interface LibraryGroup { id: string; title: string; version: string; license: string }
export interface LibraryCatalog { groups: LibraryGroup[]; entries: LibraryEntry[] }
export const maxDocumentBytes = 16 * 1024 * 1024;
export const maxCatalogBytes = 4 * 1024 * 1024;

export function safeRelativeFile(file: string): boolean {
	return !!file && !path.posix.isAbsolute(file) && !file.includes('\\') && !file.includes(':')
		&& !file.includes('\0') && file.split('/').every(part => part !== '..' && part !== '.' && part !== '');
}

export function parseCatalog(text: string): LibraryCatalog {
	const value = JSON.parse(text) as LibraryCatalog;
	if (!Array.isArray(value?.groups) || value.groups.length > 64 || !Array.isArray(value.entries) || value.entries.length > 10_000) {
		throw new Error('Invalid documentation catalog');
	}
	const groups = new Set<string>();
	const ids = new Set<string>();
	for (const group of value.groups) {
		if (!group || typeof group.id !== 'string' || !group.id || /^imported(?:-|$)/.test(group.id) || groups.has(group.id) || typeof group.title !== 'string' || typeof group.version !== 'string' || typeof group.license !== 'string') {
			throw new Error('Invalid documentation group');
		}
		groups.add(group.id);
	}
	for (const entry of value.entries) {
		if (!entry || typeof entry.id !== 'string' || !entry.id || /^imported(?:-|$)/.test(entry.id) || groups.has(entry.id) || ids.has(entry.id) || !groups.has(entry.group) || typeof entry.title !== 'string'
			|| typeof entry.file !== 'string' || !safeRelativeFile(entry.file) || !/\.(html?|md|txt)$/i.test(entry.file)
			|| typeof entry.source !== 'string' || (entry.source !== '' && new URL(entry.source).protocol !== 'https:')
			|| (entry.format !== 'html' && entry.format !== 'markdown' && entry.format !== 'text') || (entry.selector !== undefined && (typeof entry.selector !== 'string' || !/^[a-z][a-z0-9-]*$/i.test(entry.selector)))) {
			throw new Error('Invalid documentation entry');
		}
		ids.add(entry.id);
	}
	return value;
}

/** Reads bounded UTF-8 files from the official snapshot under a canonical extension directory. */
export async function readOfficialDocument(extensionPath: string, file: string, limit: number): Promise<string> {
	if (!safeRelativeFile(file)) { throw new Error('Invalid documentation path'); }
	const target = path.join(extensionPath, 'documentation', file);
	const checkPath = async () => {
		if (path.relative(target, await fs.realpath(target)) !== '') { throw new Error('Invalid documentation path'); }
	};
	await checkPath();
	const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const stat = await handle.stat();
		if (!stat.isFile() || stat.size > limit) { throw new Error('Documentation file limit'); }
		const buffer = Buffer.alloc(stat.size + 1);
		let length = 0;
		while (length < buffer.length) {
			const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
			if (!bytesRead) { break; }
			length += bytesRead;
		}
		if (length > stat.size) { throw new Error('Documentation file limit'); }
		await checkPath();
		const current = await fs.stat(target);
		if (current.dev !== stat.dev || current.ino !== stat.ino) { throw new Error('Documentation file changed'); }
		return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
	} finally {
		await handle.close();
	}
}

/** Resolves links only to catalog entries; never grants a document arbitrary filesystem access. */
export function findLocalLink(current: LibraryEntry, href: string, entries: readonly LibraryEntry[]): { entry: LibraryEntry; fragment: string } | undefined {
	try {
		if (href.startsWith('#')) {
			return { entry: current, fragment: decodeURIComponent(href.slice(1)) };
		}
		if (current.group === 'imported' && current.collection && current.importPath) {
			if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.includes('\\')) { return undefined; }
			const local = new URL(href, 'https://library.invalid/' + current.importPath.split('/').map(encodeURIComponent).join('/'));
			const file = decodeURIComponent(local.pathname.slice(1));
			const entry = entries.find(entry => entry.group === 'imported' && entry.collection === current.collection && entry.importPath === file);
			return entry ? { entry, fragment: decodeURIComponent(local.hash.slice(1)) } : undefined;
		}
		const local = new URL(href, 'https://library.invalid/' + current.file);
		const file = decodeURIComponent(local.pathname.slice(1));
		const relative = local.origin === 'https://library.invalid' ? entries.find(entry => entry.file === file && entry.group === current.group) : undefined;
		const original = current.source ? new URL(href, current.source) : undefined;
		const match = relative ?? entries.find(entry => {
			if (!original || !entry.source) { return false; }
			const source = new URL(entry.source);
			return source.origin === original.origin && source.pathname === original.pathname;
		});
		if (match) {
			return { entry: match, fragment: decodeURIComponent((original?.hash || local.hash).slice(1)) };
		}
	} catch { /* An invalid or non-catalog link remains inert. */ }
	return undefined;
}
