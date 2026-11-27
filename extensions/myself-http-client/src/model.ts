/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Buffer } from 'node:buffer';

export const maxUrlLength = 2048;
export const maxBodyBytes = 16 * 1024;

export type LocalHttpMethod = 'GET' | 'POST';
export type LocalHttpErrorCode = 'invalid-method' | 'invalid-target' | 'body-size' | 'request-failed' | 'https-failed' | 'timeout' | 'cancelled';

export class LocalHttpError extends Error {
	constructor(readonly code: LocalHttpErrorCode) {
		super(code);
	}
}

interface LocalTarget {
	readonly protocol: 'http:' | 'https:';
	readonly hostname: '127.0.0.1' | '::1';
	readonly port: number;
	readonly requestPath: string;
	readonly displayEndpoint: string;
	readonly hasQuery: boolean;
}

interface LocalRequest {
	readonly method: LocalHttpMethod;
	readonly target: LocalTarget;
	readonly body: string;
	readonly bodyBytes: number;
}

function parseLocalTarget(input: string): LocalTarget {
	if (input.length > maxUrlLength || /[\s\p{Cc}\\#]/u.test(input)) {
		throw new LocalHttpError('invalid-target');
	}
	// Check the raw authority before URL normalization, which accepts other IP spellings.
	const authority = /^(?<scheme>https?):\/\/(?<host>127\.0\.0\.1|\[::1\])(?::(?<port>\d{1,5}))?(?=[/?]|$)/u.exec(input)?.groups;
	if (!authority) {
		throw new LocalHttpError('invalid-target');
	}
	const protocol = authority.scheme === 'https' ? 'https:' : 'http:';
	const port = authority.port === undefined ? (protocol === 'https:' ? 443 : 80) : Number(authority.port);
	if (port < 1 || port > 65535) {
		throw new LocalHttpError('invalid-target');
	}
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new LocalHttpError('invalid-target');
	}
	if (url.protocol !== protocol || url.hostname !== authority.host || url.username || url.password || url.hash || url.href.length > maxUrlLength) {
		throw new LocalHttpError('invalid-target');
	}
	return {
		protocol,
		hostname: authority.host === '[::1]' ? '::1' : '127.0.0.1',
		port,
		requestPath: url.pathname + url.search,
		displayEndpoint: url.origin + url.pathname,
		hasQuery: url.search.length > 0,
	};
}

export function prepareLocalRequest(method: string, input: string, body: string): LocalRequest {
	if (method !== 'GET' && method !== 'POST') {
		throw new LocalHttpError('invalid-method');
	}
	const target = parseLocalTarget(input);
	const text = method === 'POST' ? body : '';
	const bodyBytes = Buffer.byteLength(text, 'utf8');
	if (bodyBytes > maxBodyBytes) {
		throw new LocalHttpError('body-size');
	}
	return { method, target, body: text, bodyBytes };
}
