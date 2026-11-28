/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ReadyMessage {
	kind: 'ready';
	token: string;
}

export interface DocumentMessage {
	kind: 'document';
	token: string;
	bytes: ArrayBuffer;
	engine: ArrayBuffer;
}

export interface RenderRequest {
	kind: 'render-pdf-page';
	pageNumber: number;
	bytes: Uint8Array<ArrayBuffer>;
}

export interface RenderedPixels {
	width: number;
	height: number;
	rgba: Uint8ClampedArray<ArrayBuffer>;
}

export type RenderFailure = 'limit' | 'resource' | 'password' | 'unsupported';

export type RenderReply =
	| (RenderedPixels & { kind: 'rendered'; pageCount: number })
	| { kind: 'failed'; reason: RenderFailure; pageCount: number | undefined };

export type PreviewText = Record<
	'title' | 'previous' | 'next' | 'position' | 'canvas' | 'coverage' | 'loading' |
	'resource' | 'limit' | 'password' | 'timeout' | 'unsupported' | 'worker',
	string
>;
