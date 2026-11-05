/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILogger, NullLogger } from '../../../../../platform/log/common/log.js';
import { McpIcons, ParsedMcpIcons, parseAndValidateMcpIcon, StoredMcpIcons } from '../../common/mcpIcons.js';
import { McpServerLaunch, McpServerTransportType } from '../../common/mcpTypes.js';
import { MCP } from '../../common/modelContextProtocol.js';

suite('MCP server icon implementation removed', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('all icon sources are excluded for HTTP and stdio servers', () => {
		const launches: McpServerLaunch[] = [
			{ type: McpServerTransportType.HTTP, uri: URI.parse('https://example.test'), headers: [] },
			{ type: McpServerTransportType.Stdio, command: 'test', args: [], env: {}, envFile: undefined, sandbox: undefined, cwd: undefined },
		];
		const icons: MCP.Icons = { icons: ['https://example.test/icon.png', 'http://example.test/icon.png', 'file:///test/icon.png', 'data:image/png;base64,AAA'].map(src => ({ src, mimeType: 'image/png', sizes: ['32x32'] })) };
		assert.deepStrictEqual(launches.map(launch => parseAndValidateMcpIcon(icons, launch, new NullLogger())), [[], []]);
	});

	test('parsing does not inspect metadata, launch configuration or logger', () => {
		const icons = new Proxy(upcastPartial<MCP.Icons>({}), { get() { throw new Error('Metadata read'); } });
		const launch = new Proxy(upcastPartial<McpServerLaunch>({}), { get() { throw new Error('Launch read'); } });
		const logger = new Proxy(upcastPartial<ILogger>({}), { get() { throw new Error('Logger read'); } });
		const first = parseAndValidateMcpIcon(icons, launch, logger);
		first.push({ src: URI.parse('https://example.test/stale.png'), theme: 2, sizes: [] });
		assert.deepStrictEqual(parseAndValidateMcpIcon(icons, launch, logger), []);
	});

	test('cached icons are not revived and parsed icons are not traversed', () => {
		const stored = new Proxy<StoredMcpIcons>([], { get() { throw new Error('Cache read'); } });
		const parsed = new Proxy<ParsedMcpIcons>([], { get() { throw new Error('Parsed icons read'); } });
		assert.deepStrictEqual([McpIcons.fromStored(stored).getUrl(32), McpIcons.fromParsed(parsed).getUrl(32)], [undefined, undefined]);
	});

	test('previously valid cached URLs never reach rendering at any size', () => {
		const parsed: ParsedMcpIcons = [{ src: URI.parse('https://example.test/icon.png'), theme: 2, sizes: [{ width: 32, height: 32 }] }];
		const stored: StoredMcpIcons = parsed.map(icon => ({ ...icon, src: icon.src.toJSON() }));
		const providers = [McpIcons.fromParsed(parsed), McpIcons.fromStored(stored), McpIcons.fromParsed(undefined), McpIcons.fromStored(undefined)];
		for (const provider of providers) {
			assert.deepStrictEqual([0, 16, 32, 256, Infinity, NaN].map(size => provider.getUrl(size)), Array(6).fill(undefined));
		}
	});
});
