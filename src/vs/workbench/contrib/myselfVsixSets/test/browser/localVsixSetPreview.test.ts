/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { dirname, joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IDialogService, IFileDialogService, IOpenDialogOptions, IPrompt } from '../../../../../platform/dialogs/common/dialogs.js';
import { FileSystemProviderCapabilities, FileType, IFileOpenOptions, IFileService, type IFileSystemProviderRegistrationEvent, IFileSystemProviderWithOpenReadWriteCloseCapability } from '../../../../../platform/files/common/files.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IProgress, IProgressOptions, IProgressService, IProgressStep, Progress } from '../../../../../platform/progress/common/progress.js';
import { VIEWLET_ID } from '../../../extensions/common/extensions.js';
import { localVsixSetMaxBytes } from '../../common/localVsixSet.js';
import type { LocalVsixInspector } from '../../browser/localVsixSetMetadata.js';
import { registerLocalVsixSetPreviewAction } from '../../browser/localVsixSetPreview.contribution.js';

suite('Preview Local VSIX Set', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const commandId = 'myself.extensions.previewLocalVsixSet';
	const manifest = URI.file(isWindows ? 'C:\\example\\set.json' : '/example/set.json');
	const directory = dirname(manifest);
	const archive = joinPath(directory, 'extension.vsix');
	const archiveBytes = new TextEncoder().encode('abc'.repeat(8));
	const validBytes = new TextEncoder().encode(JSON.stringify({ version: 1, entries: [
		{ id: 'publisher.extension', version: '1.2.3', file: 'extension.vsix', sha256: 'ab'.repeat(32) }
	] }));

	function fixture() {
		const pickerOptions: IOpenDialogOptions[] = [];
		const preview: IPrompt<unknown>[] = [];
		const errors: { message: string; detail: string | undefined }[] = [];
		const operations: string[] = [];
		let readBytes = 0;
		let fileType = FileType.File;
		let bytes: Uint8Array = validBytes;
		let statSize = validBytes.length;
		let readFails = false;
		let selectedButton: number | undefined;
		let inspectMetadata: LocalVsixInspector = async () => assert.fail('Unexpected package inspection');
		const registrations = store.add(new Emitter<IFileSystemProviderRegistrationEvent>());
		let cancelProgressOnRead = false;
		let cancelProgress: (() => void) | undefined;
		let selection: Promise<URI[] | undefined> = Promise.resolve([manifest]);
		const provider = new class extends mock<IFileSystemProviderWithOpenReadWriteCloseCapability>() {
			override readonly capabilities = FileSystemProviderCapabilities.FileOpenReadWriteClose;
			override async stat(resource: URI) {
				if (resource.toString() === directory.toString()) {
					operations.push('stat-directory');
					return { type: FileType.Directory, ctime: 0, mtime: 0, size: 0 };
				}
				if (resource.toString() === archive.toString()) {
					operations.push('stat-archive');
					return { type: FileType.File, ctime: 0, mtime: 0, size: archiveBytes.length };
				}
				assert.strictEqual(resource, manifest);
				operations.push('stat');
				return { type: fileType, ctime: 0, mtime: 0, size: statSize };
			}
			override async open(resource: URI, options: IFileOpenOptions): Promise<number> {
				assert.deepStrictEqual(options, { create: false });
				if (resource.toString() === archive.toString()) {
					operations.push('open-archive');
					return 43;
				}
				assert.strictEqual(resource, manifest);
				operations.push('open');
				return 42;
			}
			override async read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
				if (fd === 43) {
					const chunk = archiveBytes.subarray(pos, pos + length);
					operations.push('read-archive');
					data.set(chunk, offset);
					if (cancelProgressOnRead) {
						assert.ok(cancelProgress);
						cancelProgress();
					}
					return chunk.length;
				}
				assert.strictEqual(fd, 42);
				assert.ok(pos + length <= localVsixSetMaxBytes + 1);
				if (readFails) {
					throw new Error('private filesystem message');
				}
				const chunk = bytes.subarray(pos, pos + Math.min(length, 128));
				data.set(chunk, offset);
				readBytes += chunk.length;
				return chunk.length;
			}
			override async close(fd: number): Promise<void> {
				if (fd === 43) {
					operations.push('close-archive');
					return;
				}
				assert.strictEqual(fd, 42);
				operations.push('close');
			}
		}();
		const fileDialog = new class extends mock<IFileDialogService>() {
			override async showOpenDialog(options: IOpenDialogOptions): Promise<URI[] | undefined> {
				pickerOptions.push(options);
				return selection;
			}
		}();
		const files = new class extends mock<IFileService>() {
			override readonly onDidChangeFileSystemProviderRegistrations = registrations.event;
			override getProvider(scheme: string) {
				assert.strictEqual(scheme, Schemas.file);
				operations.push('getProvider');
				return provider;
			}
		}();
		const dialogs = new class extends mock<IDialogService>() {
			override prompt = (async (prompt: IPrompt<unknown>) => {
				preview.push(prompt);
				const result = preview.length === 1 && selectedButton !== undefined ? await prompt.buttons?.[selectedButton].run({ checkboxChecked: false }) : undefined;
				return { result };
			}) as IDialogService['prompt'];
			override async error(message: string, detail?: string): Promise<void> { errors.push({ message, detail }); }
		}();
		const progress = new class extends mock<IProgressService>() {
			override withProgress<R>(_options: IProgressOptions, task: (progress: IProgress<IProgressStep>) => Promise<R>, onDidCancel?: (choice?: number) => void): Promise<R> {
				operations.push('progress');
				cancelProgress = onDidCancel;
				return task(Progress.None);
			}
		}();
		store.add(registerLocalVsixSetPreviewAction(() => (...args) => inspectMetadata(...args)));
		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[IFileDialogService, fileDialog], [IFileService, files], [IDialogService, dialogs], [IProgressService, progress],
		), true));
		return {
			pickerOptions, preview, errors, operations,
			setSelection: (value: Promise<URI[] | undefined>) => { selection = value; },
			setBytes: (value: Uint8Array) => { bytes = value; },
			setStat: (type: FileType, size: number) => { fileType = type; statSize = size; },
			failRead: () => { readFails = true; },
			confirmChecksums: () => { selectedButton = 0; },
			confirmMetadata: (inspect: LocalVsixInspector) => {
				selectedButton = 1;
				inspectMetadata = inspect;
			},
			changeProvider: () => registrations.fire({ added: false, scheme: Schemas.file }),
			cancelProgress: () => cancelProgress?.(),
			cancelProgressOnRead: () => { cancelProgressOnRead = true; },
			getReadBytes: () => readBytes,
			async run(...args: URI[]): Promise<void> {
				await instantiation.invokeFunction(CommandsRegistry.getCommand(commandId)!.handler, ...args);
			},
		};
	}

	test('registers a visible Extensions menu entry without opening the picker or reading files', () => {
		const state = fixture();
		const [entry] = MenuRegistry.getMenuItems(MenuId.ViewContainerTitle).filter(isIMenuItem).filter(item => item.command.id === commandId);
		assert.ok(entry.when?.evaluate({ getValue: <T>() => VIEWLET_ID as T }));
		assert.deepStrictEqual([state.pickerOptions, state.operations], [[], []]);
	});

	test('uses a single local JSON picker and stops on cancellation even when a command argument is supplied', async () => {
		const state = fixture();
		state.setSelection(Promise.resolve(undefined));
		await state.run(manifest);
		const [options] = state.pickerOptions;
		assert.deepStrictEqual(options.availableFileSystems, [Schemas.file]);
		assert.strictEqual(options.canSelectFiles, true);
		assert.strictEqual(options.canSelectFolders, false);
		assert.strictEqual(options.canSelectMany, false);
		assert.deepStrictEqual(options.filters?.[0].extensions, ['json']);
		assert.deepStrictEqual([state.operations, state.preview, state.errors], [[], [], []]);
	});

	test('rejects remote, authority, query, traversal and multi-file results before touching the provider', async () => {
		const state = fixture();
		const invalid = [manifest.with({ scheme: Schemas.vscodeRemote }), manifest.with({ authority: 'server' }), manifest.with({ query: 'extra' }),
			manifest.with({ fragment: 'extra' }), manifest.with({ path: manifest.path.replace('/set.json', '/../set.json') }),
			manifest.with({ path: manifest.path.replace('.json', '.vsix') })];
		for (const selection of [...invalid.map(uri => [uri]), [manifest, manifest]]) {
			state.setSelection(Promise.resolve(selection));
			await state.run();
		}
		assert.strictEqual(state.errors.length, invalid.length + 1);
		assert.deepStrictEqual([state.operations, state.preview], [[], []]);
	});

	test('only reads the selected manifest and labels each declaration as unverified in a plain dialog', async () => {
		const state = fixture();
		await state.run();
		assert.deepStrictEqual(state.operations, ['getProvider', 'stat', 'open', 'close']);
		assert.strictEqual(state.getReadBytes(), validBytes.byteLength);
		assert.deepStrictEqual(state.errors, []);
		const [preview] = state.preview;
		assert.strictEqual(preview.custom, true);
		assert.ok(typeof preview.detail === 'string');
		assert.match(preview.detail, /Package files, hashes, and signatures are unverified/);
		assert.match(preview.detail, /publisher\.extension · 1\.2\.3/);
		assert.match(preview.detail, /File: extension\.vsix/);
		assert.match(preview.detail, new RegExp('Declared SHA-256: ' + 'ab'.repeat(32)));
		assert.deepStrictEqual(preview.buttons?.map(button => button.label), ['Check SHA-256', 'Inspect VSIX Metadata']);
		assert.strictEqual(preview.cancelButton, 'Close');
		assert.match(preview.detail, /reads only the listed VSIX files beside the manifest\. Archives must be no larger than 32 MiB\. The total read limit is 128 MiB/);
	});

	test('explicitly checking starts new local reads and shows the checksum without an install action', async () => {
		const state = fixture();
		state.confirmChecksums();
		await state.run();
		assert.deepStrictEqual(state.errors, []);
		assert.strictEqual(state.preview.length, 2);
		assert.deepStrictEqual(state.operations.filter(operation => operation !== 'getProvider'), [
			'stat', 'open', 'close', 'progress', 'stat-directory', 'stat-archive', 'open-archive', 'read-archive', 'read-archive', 'close-archive', 'stat-archive',
		]);
		const detail = state.preview[1].detail;
		assert.ok(typeof detail === 'string');
		assert.match(detail, /extension\.vsix — Mismatch/);
		assert.match(detail, /Checksum matches do not verify a package signature or installation safety/);
		assert.strictEqual(state.preview[1].buttons, undefined);
	});

	test('cancelling the progress while reading closes the handle and leaves no partial result', async () => {
		const state = fixture();
		state.confirmChecksums();
		state.cancelProgressOnRead();
		await state.run();
		assert.deepStrictEqual(state.errors, []);
		assert.strictEqual(state.preview.length, 1);
		assert.strictEqual(state.operations.filter(operation => operation === 'read-archive').length, 1);
		assert.strictEqual(state.operations.at(-1), 'close-archive');
	});

	test('compares separate metadata and digest fields after explicit consent with the exact URI and budget', async () => {
		const state = fixture();
		state.confirmMetadata(async (resource, maxBytes, token) => {
			assert.strictEqual(resource.toString(), archive.toString());
			assert.strictEqual(maxBytes, archiveBytes.length);
			assert.strictEqual(token.isCancellationRequested, false);
			assert.strictEqual(state.preview.length, 1);
			return { id: 'publisher.other', version: '1.2.3', engine: '^1.146.0', sha256: 'f'.repeat(64), bytes: maxBytes };
		});
		await state.run(manifest.with({ scheme: 'https' }));
		assert.deepStrictEqual(state.errors, []);
		assert.strictEqual(state.preview.length, 2);
		const results = state.preview[1];
		assert.ok(typeof results.detail === 'string');
		assert.match(results.detail, /ID: publisher\.other \(declared publisher\.extension\) — Mismatch/);
		assert.match(results.detail, /Version: 1\.2\.3 \(declared 1\.2\.3\) — Match/);
		assert.match(results.detail, /SHA-256: f{64} .* — Mismatch/);
		assert.match(results.detail, /Signatures, platform compatibility, and installation safety are unverified/);
		assert.strictEqual(results.buttons, undefined);
		assert.ok(!state.operations.includes('open-archive'), 'Metadata reads are isolated to the inspector');
	});

	for (const invalidation of ['cancel', 'provider change']) {
		test(`ignores a late metadata result after ${invalidation}`, async () => {
			const state = fixture();
			const started = new DeferredPromise<void>();
			const release = new DeferredPromise<void>();
			state.confirmMetadata(async (_resource, maxBytes, token) => {
				void started.complete();
				await release.p;
				assert.strictEqual(token.isCancellationRequested, true);
				return { id: 'publisher.extension', version: '1.2.3', engine: '^1.146.0', sha256: 'ab'.repeat(32), bytes: maxBytes };
			});
			const inspection = state.run();
			await started.p;
			if (invalidation === 'cancel') {
				state.cancelProgress();
			} else {
				state.changeProvider();
			}
			await release.complete();
			await inspection;
			assert.strictEqual(state.preview.length, 1);
			assert.deepStrictEqual(state.errors, []);
		});
	}

	test('accepts a valid manifest exactly at the byte limit', async () => {
		const state = fixture();
		const bytes = new Uint8Array(localVsixSetMaxBytes).fill(0x20);
		bytes.set(validBytes);
		state.setStat(FileType.File, bytes.byteLength);
		state.setBytes(bytes);
		await state.run();
		assert.strictEqual(state.getReadBytes(), localVsixSetMaxBytes);
		assert.strictEqual(state.preview.length, 1);
		assert.deepStrictEqual(state.errors, []);
	});

	test('rejects special files and oversized manifests before opening a handle', async () => {
		const state = fixture();
		for (const [type, size] of [[FileType.File | FileType.SymbolicLink, 32], [FileType.Unknown, 32], [FileType.File, localVsixSetMaxBytes + 1]]) {
			state.setStat(type, size);
			await state.run();
		}
		assert.strictEqual(state.errors.length, 3);
		assert.deepStrictEqual(state.operations, ['getProvider', 'stat', 'getProvider', 'stat', 'getProvider', 'stat']);
		assert.deepStrictEqual(state.preview, []);
	});

	test('detects growth without reading more than one byte beyond the manifest limit', async () => {
		const state = fixture();
		state.setBytes(new Uint8Array(localVsixSetMaxBytes + 4096));
		await state.run();
		assert.strictEqual(state.getReadBytes(), localVsixSetMaxBytes + 1);
		assert.deepStrictEqual(state.operations, ['getProvider', 'stat', 'open', 'close']);
		assert.match(state.errors[0].detail!, /64 KiB/);
		assert.deepStrictEqual(state.preview, []);
	});

	test('closes the read handle on error without exposing filesystem messages', async () => {
		const state = fixture();
		state.failRead();
		await state.run();
		assert.deepStrictEqual(state.operations, ['getProvider', 'stat', 'open', 'close']);
		assert.doesNotMatch(state.errors[0].detail!, /private filesystem message/);
		assert.deepStrictEqual(state.preview, []);
	});

	test('coalesces repeated invocation while a picker is open', async () => {
		const state = fixture();
		const selection = new DeferredPromise<URI[] | undefined>();
		state.setSelection(selection.p);
		const first = state.run();
		await state.run();
		await selection.complete(undefined);
		await first;
		assert.strictEqual(state.pickerOptions.length, 1);
		assert.deepStrictEqual(state.operations, []);
	});
});
