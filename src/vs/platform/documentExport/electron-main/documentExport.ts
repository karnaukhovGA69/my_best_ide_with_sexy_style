/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserWindow, session } from 'electron';
import { promises as fs } from 'fs';
import { dirname, join } from '../../../base/common/path.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { URI } from '../../../base/common/uri.js';
import { documentPdfFileName, documentPdfHtml, DocumentPdfResultV1, validateDocumentPdfRequest } from '../common/documentExport.js';

const activeExports = new Set<number>();

export async function renderDocumentPdf(input: unknown, owner?: BrowserWindow): Promise<Buffer> {
	const request = validateDocumentPdfRequest(input);
	const printSession = session.fromPartition(`myself-document-pdf-${generateUuid()}`, { cache: false });
	printSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
	printSession.setPermissionCheckHandler(() => false);
	const url = `data:text/html;charset=utf-8,${encodeURIComponent(documentPdfHtml(request))}`;
	printSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: details.url !== url }));
	const window = new BrowserWindow({ show: false, parent: owner, width: 794, height: 1123, webPreferences: { session: printSession, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true, spellcheck: false } });
	window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	window.webContents.on('will-navigate', event => event.preventDefault());
	let timer: ReturnType<typeof setTimeout> | undefined;
	const onOwnerClosed = () => { if (!window.isDestroyed()) { window.destroy(); } };
	owner?.once('closed', onOwnerClosed);
	try {
		return await Promise.race([
			(async () => {
				await window.loadURL(url);
				const margin = request.page.marginMm / 25.4;
				return window.webContents.printToPDF({ pageSize: 'A4', printBackground: false, margins: { top: margin, bottom: margin, left: margin, right: margin } });
			})(),
			new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('PDF export timed out.')), 30_000); })
		]);
	} catch {
		// Do not propagate Electron errors containing a data URL with document text.
		throw new Error('Unable to render PDF. The document was not saved.');
	} finally {
		clearTimeout(timer);
		owner?.removeListener('closed', onOwnerClosed);
		if (!window.isDestroyed()) { window.destroy(); }
		printSession.webRequest.onBeforeRequest(null);
		await printSession.clearStorageData();
		await printSession.clearCache();
	}
}

export async function exportDocumentPdf(owner: BrowserWindow, input: unknown, chooseDestination: (name: string) => Promise<string | undefined>): Promise<DocumentPdfResultV1> {
	const request = validateDocumentPdfRequest(input);
	if (owner.isDestroyed()) { throw new Error('The document window is closed.'); }
	if (activeExports.has(owner.id)) { throw new Error('A PDF export is already in progress in this window.'); }
	activeExports.add(owner.id);
	let temporaryPath: string | undefined;
	try {
		const destination = await chooseDestination(documentPdfFileName(request.suggestedFileName));
		if (!destination || owner.isDestroyed()) { return { status: 'cancelled' }; }
		const pdf = await renderDocumentPdf(request, owner);
		if (owner.isDestroyed()) { return { status: 'cancelled' }; }
		temporaryPath = join(dirname(destination), `.myself-pdf-${generateUuid()}.tmp`);
		await fs.writeFile(temporaryPath, pdf, { flag: 'wx', mode: 0o600 });
		if (owner.isDestroyed()) { return { status: 'cancelled' }; }
		await fs.rename(temporaryPath, destination);
		temporaryPath = undefined;
		return { status: 'saved', uri: URI.file(destination).toString() };
	} finally {
		activeExports.delete(owner.id);
		if (temporaryPath) { await fs.unlink(temporaryPath).catch(() => undefined); }
	}
}
