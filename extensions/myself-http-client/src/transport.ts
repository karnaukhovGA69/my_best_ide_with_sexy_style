/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Buffer } from 'node:buffer';
import { request as httpRequest, ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { clearTimeout, setTimeout } from 'node:timers';
import { LocalHttpError, prepareLocalRequest } from './model';

export const maxResponseBytes = 64 * 1024;
export const maxResponseHeaderBytes = 8 * 1024;
export const requestTimeoutMs = 10_000;

export interface LocalHttpResponse {
	readonly status: number;
	readonly text: string;
	readonly truncated: boolean;
}

export async function sendLocalRequest(method: string, url: string, body: string, signal: AbortSignal): Promise<LocalHttpResponse> {
	const input = prepareLocalRequest(method, url, body);
	if (signal.aborted) {
		throw new LocalHttpError('cancelled');
	}

	const secure = input.target.protocol === 'https:';
	const failed = () => new LocalHttpError(secure ? 'https-failed' : 'request-failed');
	const headers: Record<string, string | number> = { 'Accept-Encoding': 'identity', Connection: 'close' };
	if (input.method === 'POST') {
		headers['Content-Type'] = 'text/plain; charset=utf-8';
		headers['Content-Length'] = input.bodyBytes;
	}
	const options: RequestOptions = {
		protocol: input.target.protocol,
		hostname: input.target.hostname,
		port: input.target.port,
		path: input.target.requestPath,
		method: input.method,
		headers,
		agent: false,
		maxHeaderSize: maxResponseHeaderBytes,
	};

	return new Promise<LocalHttpResponse>((resolve, reject) => {
		let outgoing: ClientRequest | undefined;
		let incoming: IncomingMessage | undefined;
		let deadline: ReturnType<typeof setTimeout> | undefined;
		let settled = false;

		function finish(result: LocalHttpResponse | LocalHttpError): void {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(deadline);
			signal.removeEventListener('abort', onCancel);
			incoming?.destroy();
			outgoing?.destroy();
			if (result instanceof LocalHttpError) {
				reject(result);
			} else {
				resolve(result);
			}
		}

		function onCancel(): void {
			finish(new LocalHttpError('cancelled'));
		}

		function onResponse(response: IncomingMessage): void {
			incoming = response;
			response.once('error', () => finish(failed()));
			if (settled || response.statusCode === undefined) {
				response.destroy();
				finish(failed());
				return;
			}
			const status = response.statusCode;
			const chunks: Buffer[] = [];
			let bytes = 0;
			function complete(truncated: boolean): void {
				finish({ status, text: Buffer.concat(chunks, bytes).toString('utf8'), truncated });
			}
			response.on('data', (chunk: Buffer) => {
				if (settled) {
					return;
				}
				const remaining = maxResponseBytes - bytes;
				if (chunk.length > remaining) {
					if (remaining > 0) {
						chunks.push(chunk.subarray(0, remaining));
						bytes += remaining;
					}
					complete(true);
				} else {
					chunks.push(chunk);
					bytes += chunk.length;
				}
			});
			response.once('end', () => complete(false));
			response.once('aborted', () => finish(failed()));
			response.once('close', () => finish(failed()));
		}

		try {
			outgoing = secure ? httpsRequest({ ...options, rejectUnauthorized: true }, onResponse) : httpRequest(options, onResponse);
			outgoing.once('error', () => finish(failed()));
			outgoing.once('upgrade', (_response, socket) => {
				socket.destroy();
				finish(failed());
			});
			signal.addEventListener('abort', onCancel, { once: true });
			deadline = setTimeout(() => finish(new LocalHttpError('timeout')), requestTimeoutMs);
			if (signal.aborted) {
				onCancel();
				return;
			}
			outgoing.end(input.method === 'POST' ? Buffer.from(input.body, 'utf8') : undefined);
		} catch {
			finish(failed());
		}
	});
}
