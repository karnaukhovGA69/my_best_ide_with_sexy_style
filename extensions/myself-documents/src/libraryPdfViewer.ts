/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { isRecord } from './document';

const viewerId = 'myself.myself-local-pdf-viewer';
const viewerVersion = '0.1.0';

interface PdfViewerApi {
	readonly apiVersion: 1;
	openBytes(bytes: Uint8Array): Promise<boolean>;
}

function localViewer(): vscode.Extension<unknown> | undefined {
	// The public lookup only includes this extension host.
	const viewer = vscode.extensions.getExtension<unknown>(viewerId);
	if (viewer?.id !== viewerId || viewer.extensionKind !== vscode.ExtensionKind.UI || viewer.packageJSON?.version !== viewerVersion) { return undefined; }
	const { scheme, authority, query, fragment } = viewer.extensionUri;
	return scheme === 'file' && !authority && !query && !fragment ? viewer : undefined;
}

function isViewerApi(api: unknown): api is PdfViewerApi {
	return isRecord(api) && api.apiVersion === 1 && typeof api.openBytes === 'function';
}

export async function openPdfInLocalViewer(read: () => Promise<Uint8Array>, isCurrent: () => boolean): Promise<void> {
	if (!isCurrent()) { return; }
	const viewerMissing = () => vscode.window.showInformationMessage(vscode.l10n.t('PDF preview requires a compatible local Nerded Code PDF Viewer. Use Extensions → Install from VSIX… to install it from a local VSIX.'));
	const viewer = localViewer();
	if (!viewer || (viewer.isActive && !isViewerApi(viewer.exports))) {
		void viewerMissing();
		return;
	}

	const location = viewer.extensionUri.toString();
	let bytes: Uint8Array;
	try {
		bytes = await read();
	} catch {
		if (isCurrent()) {
			void vscode.window.showErrorMessage(vscode.l10n.t('The library PDF copy is missing, has changed, or could not be verified. Import a new copy to preview it.'));
		}
		return;
	}
	if (!isCurrent()) { return; }

	const stillRegistered = (candidate: vscode.Extension<unknown> | undefined): candidate is vscode.Extension<unknown> =>
		!!candidate && candidate.extensionUri.toString() === location;
	let api: unknown;
	try {
		const candidate = localViewer();
		if (!stillRegistered(candidate)) { void viewerMissing(); return; }
		api = candidate.isActive ? candidate.exports : await candidate.activate();
		if (!isCurrent()) { return; }
		const current = localViewer();
		if (!stillRegistered(current) || !current.isActive || current.exports !== api || !isViewerApi(api)) {
			void viewerMissing();
			return;
		}
	} catch {
		if (isCurrent()) { void viewerMissing(); }
		return;
	}

	try {
		if (await api.openBytes(bytes) === true || !isCurrent()) { return; }
	} catch {
		if (!isCurrent()) { return; }
	}
	void vscode.window.showErrorMessage(vscode.l10n.t('The local PDF viewer could not open the verified library copy.'));
}
