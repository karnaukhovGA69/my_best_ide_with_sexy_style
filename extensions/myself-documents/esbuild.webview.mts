/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'node:path';
import { run } from '../esbuild-webview-common.mts';

const srcDir = path.join(import.meta.dirname, 'webview');

run({
	entryPoints: { 'editor': path.join(srcDir, 'editor.ts') },
	srcDir,
	outdir: path.join(import.meta.dirname, 'out', 'webview'),
}, process.argv);
