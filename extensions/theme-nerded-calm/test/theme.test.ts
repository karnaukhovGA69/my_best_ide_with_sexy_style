/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../src/vs/base/common/uri.js';
import { mock } from '../../../src/vs/base/test/common/mock.js';
import { Color } from '../../../src/vs/base/common/color.js';
import { IExtensionResourceLoaderService } from '../../../src/vs/platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { ILanguageService } from '../../../src/vs/editor/common/languages/language.js';
import { ColorThemeData } from '../../../src/vs/workbench/services/themes/common/colorThemeData.js';
import { FileIconThemeData, FileIconThemeLoader } from '../../../src/vs/workbench/services/themes/browser/fileIconThemeData.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../src/vs/base/test/common/utils.js';

// Served from the repository root by the targeted browser resource harness.
const resourceRoot = '/extensions/theme-nerded-calm/';
const loader = new class extends mock<IExtensionResourceLoaderService>() {
	override async readExtensionResource(uri: URI): Promise<string> {
		const response = await fetch(uri.toString());
		assert.ok(response.ok, uri.toString());
		return response.text();
	}
};
const locationFor = (relative: string) => URI.parse(new URL(resourceRoot + relative, window.location.href).href);

suite('Calmer Studio resources in workbench loaders', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	async function loadColors(): Promise<ColorThemeData> {
		const theme = ColorThemeData.createUnloadedTheme('vs-dark');
		theme.location = locationFor('themes/nerded-calm.json');
		await theme.ensureLoaded(loader);
		return theme;
	}

	test('loads approved surfaces and TextMate scopes including nested syntax', async () => {
		const theme = await loadColors();
		assert.strictEqual(theme.getColor('editor.background')?.toString(), '#101010');
		assert.strictEqual(theme.getColor('editor.background')?.isOpaque(), true);
		assert.strictEqual(theme.getColor('sideBar.background')?.toString(), '#151515');
		for (const [scope, color] of [
			['comment.line', '#A39CA9'],
			['keyword.control', '#E8B4D9'],
			['entity.name.function', '#B9DDFC'],
			['string.quoted.double', '#D8C7F1'],
			['variable.other.readwrite', '#E6E2DD'],
			['constant.numeric', '#E6CB96'],
		]) {
			assert.deepStrictEqual(theme.resolveScopes([['source.ts', scope]])?.foreground, Color.fromHex(color), scope);
		}
	});

	test('semantic tokens keep the palette and deprecation styling', async () => {
		const theme = await loadColors();
		assert.strictEqual(theme.semanticHighlighting, true);
		for (const [type, color] of [['function', '#B9DDFC'], ['string', '#D8C7F1'], ['keyword', '#E8B4D9'], ['variable', '#E6E2DD']]) {
			const metadata = theme.getTokenStyleMetadata(type, [], 'typescript');
			assert.strictEqual(theme.tokenColorMap[metadata!.foreground!], color, type);
		}
		assert.strictEqual(theme.getTokenStyleMetadata('function', ['deprecated'], 'typescript')?.strikethrough, true);
	});

	test('explicit user colors survive reload and do not affect another theme', async () => {
		const theme = await loadColors();
		theme.setCustomColors({ 'editor.background': '#20242A', 'focusBorder': '#FFCC00' });
		await theme.reload(loader);
		assert.strictEqual(theme.getColor('editor.background')?.toString(), '#20242a');
		assert.strictEqual(theme.getColor('focusBorder')?.toString(), '#ffcc00');
		const other = ColorThemeData.createUnloadedTheme('hc-black');
		assert.notStrictEqual(other.getColor('editor.background')?.toString(), '#101010');
		assert.strictEqual((await loadColors()).getColor('editor.background')?.toString(), '#101010');
	});

	test('file icon loader emits colorful local images, light overrides and folder states', async () => {
		const data = FileIconThemeData.createUnloadedTheme('nerded-calm-file-icons');
		data.location = locationFor('fileicons/vscode-icons.json');
		const languageService = new class extends mock<ILanguageService>() { };
		const css = await data.ensureLoaded(new FileIconThemeLoader(loader, languageService));
		assert.strictEqual(data.hasFileIcons, true);
		assert.strictEqual(data.hasFolderIcons, true);
		assert.strictEqual(data.hidesExplorerArrows, false);
		assert.ok(css?.includes('background-image: url('));
		assert.ok(css?.includes('.vs '));
		assert.ok(!css?.includes('mask:'));
		assert.ok(!css?.includes('background-color: currentColor'));
		const style = document.createElement('style');
		style.textContent = css!;
		const container = document.createElement('div');
		container.className = 'vs-dark';
		const list = container.appendChild(document.createElement('div'));
		list.className = 'show-file-icons';
		const file = list.appendChild(document.createElement('span'));
		file.className = 'file-icon';
		const twistie = list.appendChild(document.createElement('span'));
		twistie.className = 'monaco-tl-twistie collapsible collapsed';
		const contents = list.appendChild(document.createElement('div'));
		contents.className = 'monaco-tl-contents';
		const folder = contents.appendChild(document.createElement('span'));
		folder.className = 'folder-icon';
		document.head.appendChild(style);
		document.body.appendChild(container);
		try {
			const background = (element: HTMLElement) => getComputedStyle(element, '::before').backgroundImage;
			assert.ok(background(file).includes('/assets/default_file.svg'));
			assert.ok(background(folder).includes('/assets/default_folder.svg'));
			twistie.classList.remove('collapsed');
			assert.ok(background(folder).includes('/assets/default_folder_opened.svg'));
			file.classList.add('typescript-lang-file-icon');
			assert.ok(background(file).includes('/assets/file_type_typescript.svg'));
			container.className = 'vs';
			file.className = 'file-icon';
			assert.ok(background(file).includes('/assets/default_file.svg'), 'light placeholder inherits the base icon');
			file.classList.add('vite.config.ts-name-file-icon', 'name-file-icon', 'config.ts-ext-file-icon', 'ts-ext-file-icon', 'ext-file-icon');
			assert.ok(background(file).includes('/assets/file_type_light_vite.svg'));
			const sheet = style.sheet!;
			let imageCount = 0;
			for (const rule of Array.from(sheet.cssRules)) {
				const image = (rule as CSSStyleRule).style.backgroundImage;
				if (image.startsWith('url(')) {
					assert.ok(image.includes(new URL(resourceRoot + 'fileicons/assets/', window.location.href).href), image);
					imageCount++;
				}
			}
			assert.ok(imageCount > 1000);
		} finally {
			container.remove();
			style.remove();
		}
	});
});
