/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Only webview-backed local resources may load automatically; external links stay navigable. */
export function getLocalResourceCsp(cspSource: string, nonce: string, mode: 'preview' | 'editor'): string {
	const resourceSource = cspSource.split(';')[0];
	const editor = mode === 'editor';
	const none = `'none'`;
	return [
		`default-src ${none}`,
		`img-src 'self' ${resourceSource} data:`,
		`media-src 'self' ${resourceSource} data:`,
		`style-src 'self' ${resourceSource} 'unsafe-inline'`,
		`font-src 'self' ${resourceSource} data:`,
		`script-src 'nonce-${nonce}'${editor ? ` ${resourceSource}` : ''}`,
		`connect-src ${editor ? resourceSource : none}`,
		`worker-src ${editor ? `${resourceSource} blob:` : none}`,
		`frame-src ${editor ? `'self'` : none}`,
		`form-action ${none}`,
	].join('; ') + ';';
}
