/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { resolve } from '../../../../base/common/path.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { OPTIONS, parseArgs } from '../../node/argv.js';
import { getDefaultUserDataPath, getUserDataPath } from '../../node/userDataPath.js';
import product from '../../../product/common/product.js';
import { NativeEnvironmentService } from '../../node/environmentService.js';

suite('User data path', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('branding preserves the existing profile and path override precedence', () => {
		const keys = ['VSCODE_DEV', 'VSCODE_PORTABLE', 'VSCODE_APPDATA'];
		const original = keys.map(key => process.env[key]);
		store.add(toDisposable(() => keys.forEach((key, index) => {
			if (original[index] === undefined) { delete process.env[key]; }
			else { process.env[key] = original[index]; }
		})));
		keys.forEach(key => delete process.env[key]);
		const args = parseArgs([], OPTIONS);
		const renamed = { ...product, _serviceBrand: undefined, nameShort: 'Nerded Code', userDataFolderName: 'Myself IDE' };
		const path = () => new NativeEnvironmentService(args, renamed).userDataPath;
		assert.strictEqual(path(), getDefaultUserDataPath('Myself IDE'));
		assert.strictEqual(path(), getUserDataPath(args, renamed.userDataFolderName));
		assert.strictEqual(new NativeEnvironmentService(args, { ...renamed, userDataFolderName: undefined }).userDataPath, getDefaultUserDataPath('Nerded Code'));
		args['user-data-dir'] = resolve('explicit-profile');
		assert.strictEqual(path(), args['user-data-dir']);
		process.env['VSCODE_APPDATA'] = resolve('custom-appdata');
		assert.strictEqual(path(), resolve('custom-appdata', 'Myself IDE'));
		process.env['VSCODE_PORTABLE'] = resolve('portable-root');
		assert.strictEqual(path(), resolve('portable-root', 'user-data'));
		delete process.env['VSCODE_PORTABLE'];
		process.env['VSCODE_DEV'] = '1';
		assert.strictEqual(path(), resolve('custom-appdata', 'code-oss-dev'));
		delete process.env['VSCODE_APPDATA'];
		args['user-data-dir'] = '';
		assert.strictEqual(path(), getDefaultUserDataPath('code-oss-dev'));
	});

	test('getUserDataPath - default', () => {
		const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
		assert.ok(path.length > 0);
	});

	test('getUserDataPath - portable mode', () => {
		const origPortable = process.env['VSCODE_PORTABLE'];
		store.add(toDisposable(() => {
			if (typeof origPortable === 'string') {
				process.env['VSCODE_PORTABLE'] = origPortable;
			} else {
				delete process.env['VSCODE_PORTABLE'];
			}
		}));
		const portableDir = 'portable-dir';
		process.env['VSCODE_PORTABLE'] = portableDir;

		const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
		assert.ok(path.includes(portableDir));
	});

	test('getUserDataPath - --user-data-dir', () => {
		const cliUserDataDir = 'cli-data-dir';
		const args = parseArgs(process.argv, OPTIONS);
		args['user-data-dir'] = cliUserDataDir;

		const path = getUserDataPath(args, product.nameShort);
		assert.ok(path.includes(cliUserDataDir));
	});

	test('getUserDataPath - VSCODE_APPDATA', () => {
		const origAppData = process.env['VSCODE_APPDATA'];
		store.add(toDisposable(() => {
			if (typeof origAppData === 'string') {
				process.env['VSCODE_APPDATA'] = origAppData;
			} else {
				delete process.env['VSCODE_APPDATA'];
			}
		}));
		const appDataDir = 'appdata-dir';
		process.env['VSCODE_APPDATA'] = appDataDir;

		const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
		assert.ok(path.includes(appDataDir));
	});
});
