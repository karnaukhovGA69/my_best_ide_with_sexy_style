/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { createCodeEditorServices } from '../../../../../editor/test/browser/testCodeEditor.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { renderMarkdownDocument } from '../../browser/markdownDocumentRenderer.js';


suite('Markdown Document Renderer Test', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let extensionService: IExtensionService;
	let languageService: ILanguageService;

	setup(() => {
		instantiationService = createCodeEditorServices(store);
		extensionService = instantiationService.get(IExtensionService);
		languageService = instantiationService.get(ILanguageService);
	});

	test('Should remove images with relative paths by default', async () => {
		const result = await renderMarkdownDocument('![alt](src/img.png)', extensionService, languageService, {});
		assert.strictEqual(result.toString(), `<p><img alt="alt"></p>\n`);
	});

	test('Can enable images with relative paths using setting', async () => {
		const result = await renderMarkdownDocument('![alt](src/img.png)', extensionService, languageService, {
			sanitizerConfig: {
				allowRelativeMediaPaths: true,
			}
		});

		assert.strictEqual(result.toString(), `<p><img src="src/img.png" alt="alt"></p>\n`);
	});
	test('blocks external and network-path media even with permissive protocol options', async () => {
		const content = [
			'![remote](https://example.test/image.png)',
			'<video src="http://example.test/movie.webm" poster="https://example.test/poster.png"></video>',
			'<audio src="//example.test/audio.mp3"></audio>',
			'<img src="file://server/share/image.png">',
			'<img src="file:////server/share/image.png">',
			'[Manual link](https://example.test/docs)',
		].join('\n\n');
		const result = await renderMarkdownDocument(content, extensionService, languageService, {
			sanitizerConfig: { allowedMediaProtocols: { override: '*' }, allowRelativeMediaPaths: true },
		});
		const document = new DOMParser().parseFromString(result.toString(), 'text/html');
		assert.strictEqual(document.querySelectorAll('[src], [poster]').length, 0);
		assert.strictEqual(document.querySelector('a')?.getAttribute('href'), 'https://example.test/docs');
	});

	test('preserves local files, inline images, and explicit relative media', async () => {
		const result = await renderMarkdownDocument([
			'![local](file:///docs/image.png)',
			'![inline](data:image/png;base64,AA==)',
			'![relative](images/local.png)',
		].join('\n\n'), extensionService, languageService, { sanitizerConfig: { allowRelativeMediaPaths: true } });
		const document = new DOMParser().parseFromString(result.toString(), 'text/html');
		assert.deepStrictEqual([...document.querySelectorAll('img')].map(image => image.getAttribute('src')), [
			'file:///docs/image.png', 'data:image/png;base64,AA==', 'images/local.png',
		]);
	});

	test('augmentation cannot enable style, srcset, or embedded network loaders', async () => {
		const result = await renderMarkdownDocument([
			'<style>@import "https://example.test/style.css";</style>',
			'<link rel="stylesheet" href="https://example.test/other.css">',
			'<iframe src="https://example.test/frame"></iframe>',
			'<svg><path fill="url(https://example.test/paint.svg#x)" stroke="currentColor"></path></svg>',
			'<img srcset="https://example.test/image.png 1x" style="background:url(https://example.test/background.png)">',
		].join('\n'), extensionService, languageService, { sanitizerConfig: {
			allowedMediaProtocols: { override: '*' },
			allowedTags: { augment: ['style', 'link', 'iframe', 'svg', 'path'] },
			allowedAttributes: { augment: ['srcset', 'style', 'rel', 'fill', 'stroke'] },
		} });
		const document = new DOMParser().parseFromString(result.toString(), 'text/html');
		assert.strictEqual(document.querySelectorAll('style, link, iframe, [srcset], [style], [fill]').length, 0);
		assert.strictEqual(document.querySelector('path')?.getAttribute('stroke'), 'currentColor');
	});

	test('attaching a document does not activate HTTP media', async () => {
		const target = `${mainWindow.location.origin}/blocked-document-media`;
		const result = await renderMarkdownDocument(`![remote](${target}/image.png)\n\n<video src="${target}/video.webm" poster="${target}/poster.png"></video>`, extensionService, languageService);
		const container = document.createElement('div');
		container.innerHTML = result.toString();
		document.body.appendChild(container);
		try {
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.strictEqual(container.querySelectorAll('[src], [poster]').length, 0);
		} finally {
			container.remove();
		}
	});

});
