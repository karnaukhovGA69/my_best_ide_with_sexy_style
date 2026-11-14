/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { extractZip, isMacArm64Executable, isPortableArchivePath, snapshotZip } from './archive';

const packageId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digest = /^[0-9a-f]{64}$/;
const manifestName = 'package.json';
const manifestSizeLimit = 8192;

export interface InstalledPackage {
	readonly schemaVersion: 1;
	readonly id: string;
	readonly entryRelative: string;
	readonly archiveSha256: string;
	readonly treeSha256: string;
	readonly provenance: 'unverified';
	readonly execution: 'requires-assessment';
}

export interface PackagePreview {
	readonly entrypoints: readonly string[];
	readonly archiveSha256: string;
}

function isInstalledPackage(value: unknown, id: string): value is InstalledPackage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const manifest = value as Partial<InstalledPackage>;
	return manifest.schemaVersion === 1 && manifest.id === id && manifest.provenance === 'unverified'
		&& manifest.execution === 'requires-assessment'
		&& typeof manifest.entryRelative === 'string' && isPortableArchivePath(manifest.entryRelative)
		&& typeof manifest.archiveSha256 === 'string' && digest.test(manifest.archiveSha256)
		&& typeof manifest.treeSha256 === 'string' && digest.test(manifest.treeSha256);
}

function fileWasRemoved(error: unknown): boolean {
	return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

export class PackageStore {
	private readonly root: string;

	constructor(storageDirectory: string, private readonly onCleanupError?: (error: unknown) => void) {
		if (!isAbsolute(storageDirectory)) {
			throw new Error('Package storage must be an absolute local path.');
		}
		this.root = join(storageDirectory, 'managed');
	}

	private async ensureRoot(): Promise<void> {
		const storagePath = dirname(this.root);
		await mkdir(storagePath, { recursive: true, mode: 0o700 });
		const storage = await lstat(storagePath);
		if (!storage.isDirectory() || storage.uid !== process.getuid?.() || (storage.mode & 0o022)) {
			throw new Error('The extension storage path is not a directory.');
		}
		await mkdir(this.root, { recursive: true, mode: 0o700 });
		const root = await lstat(this.root);
		if (!root.isDirectory() || (root.mode & 0o077) || root.uid !== process.getuid?.()) {
			throw new Error('The managed package directory is not private.');
		}
	}

	async importZip(source: string, select: (preview: PackagePreview) => Promise<string | undefined>, signal?: AbortSignal): Promise<InstalledPackage | undefined> {
		if (process.platform !== 'darwin' || process.arch !== 'arm64') {
			throw new Error('ZIP import currently supports macOS ARM64.');
		}
		if (!isAbsolute(source)) {
			throw new Error('Select a local ZIP file.');
		}
		await this.ensureRoot();
		signal?.throwIfAborted();
		const staging = await mkdtemp(join(this.root, '.import-'));
		let committed = false;
		try {
			const snapshot = join(staging, 'archive.zip');
			const archiveSha256 = await snapshotZip(source, snapshot, signal);
			const installation = join(staging, 'install');
			const payload = join(installation, 'payload');
			await mkdir(payload, { recursive: true, mode: 0o700 });
			const { files, treeSha256 } = await extractZip(snapshot, payload, signal);
			const entrypoints: string[] = [];
			for (const file of files) {
				signal?.throwIfAborted();
				if (await isMacArm64Executable(join(payload, ...file.split('/')))) {
					entrypoints.push(file);
				}
			}
			if (!entrypoints.length) {
				throw new Error('The ZIP contains no compatible macOS ARM64 executable.');
			}
			const entryRelative = await select({ entrypoints: Object.freeze(entrypoints), archiveSha256 });
			signal?.throwIfAborted();
			if (entryRelative === undefined) {
				return undefined;
			}
			if (!entrypoints.includes(entryRelative)) {
				throw new Error('Select an executable from the inspected archive.');
			}
			const id = randomUUID();
			const installed: InstalledPackage = {
				schemaVersion: 1, id, entryRelative, archiveSha256, treeSha256,
				provenance: 'unverified', execution: 'requires-assessment',
			};
			await writeFile(join(installation, manifestName), JSON.stringify(installed, null, '\t') + '\n', { flag: 'wx', mode: 0o600 });
			signal?.throwIfAborted();
			// Remove the archive before commit so an archive cleanup failure cannot
			// leave a published package whose import was reported as failed.
			await rm(snapshot);
			signal?.throwIfAborted();
			await rename(installation, join(this.root, id));
			committed = true;
			return installed;
		} finally {
			try {
				await (committed ? rmdir(staging) : rm(staging, { recursive: true, force: true }));
			} catch (error) {
				this.onCleanupError?.(error);
			}
		}
	}

	async list(): Promise<InstalledPackage[]> {
		await this.ensureRoot();
		const directories = await readdir(this.root, { withFileTypes: true });
		const packages: InstalledPackage[] = [];
		for (const directory of directories) {
			if (!directory.isDirectory() || !packageId.test(directory.name)) {
				continue;
			}
			const manifest = await this.readPackage(join(this.root, directory.name), directory.name);
			if (manifest) {
				packages.push(manifest);
			}
		}
		return packages.sort((a, b) => basename(a.entryRelative).localeCompare(basename(b.entryRelative)) || a.id.localeCompare(b.id));
	}

	private async readPackage(directory: string, id: string): Promise<InstalledPackage | undefined> {
		try {
			const stat = await lstat(directory);
			if (!stat.isDirectory() || (stat.mode & 0o077) || stat.uid !== process.getuid?.()) {
				return undefined;
			}
			const payload = join(directory, 'payload');
			if (!(await lstat(payload)).isDirectory()) {
				return undefined;
			}
			const handle = await open(join(directory, manifestName), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
			try {
				const stat = await handle.stat();
				if (!stat.isFile() || stat.nlink !== 1 || stat.size > manifestSizeLimit) {
					return undefined;
				}
				const buffer = Buffer.alloc(manifestSizeLimit + 1);
				const { bytesRead } = await handle.read(buffer);
				if (bytesRead !== stat.size) {
					return undefined;
				}
				const manifest: unknown = JSON.parse(buffer.toString('utf8', 0, bytesRead));
				if (!isInstalledPackage(manifest, id)) {
					return undefined;
				}
				let target = payload;
				const segments = manifest.entryRelative.split('/');
				for (let index = 0; index < segments.length; index++) {
					target = join(target, segments[index]);
					const entry = await lstat(target);
					if (index === segments.length - 1 ? !entry.isFile() : !entry.isDirectory()) {
						return undefined;
					}
				}
				return manifest;
			} finally {
				await handle.close();
			}
		} catch (error) {
			if (!fileWasRemoved(error) && (error as NodeJS.ErrnoException)?.code !== 'ELOOP' && !(error instanceof SyntaxError)) {
				throw error;
			}
			return undefined;
		}
	}

	async remove(id: string): Promise<void> {
		if (!packageId.test(id)) {
			throw new Error('Invalid managed package ID.');
		}
		await this.ensureRoot();
		const installation = join(this.root, id);
		const trash = join(this.root, '.removed-' + id);
		if (await this.readPackage(installation, id)) {
			try {
				await rename(installation, trash);
			} catch (error) {
				if (!fileWasRemoved(error)) {
					throw error;
				}
			}
		} else if (await lstat(installation).catch(error => {
			if (!fileWasRemoved(error)) {
				throw error;
			}
			return undefined;
		})) {
			throw new Error('The folder is not a valid managed package.');
		}

		await this.cleanupRemovedPackage(id);
	}

	async cleanupRemovedPackages(): Promise<void> {
		await this.ensureRoot();
		for (const directory of await readdir(this.root, { withFileTypes: true })) {
			if (directory.name.startsWith('.removed-')) {
				const id = directory.name.slice('.removed-'.length);
				if (packageId.test(id)) {
					await this.cleanupRemovedPackage(id);
				}
			}
		}
	}

	private async cleanupRemovedPackage(id: string): Promise<void> {
		const trash = join(this.root, '.removed-' + id);
		// A previous cleanup may have partly removed this directory. Its name is
		// reserved for packages atomically claimed for removal.
		try {
			const pending = await lstat(trash);
			if (!pending.isDirectory() || (pending.mode & 0o077) || pending.uid !== process.getuid?.()) {
				throw new Error('The removal directory is not a private directory.');
			}
			await rm(trash, { recursive: true, force: true });
		} catch (error) {
			if (!fileWasRemoved(error)) {
				throw new Error('Package cleanup is incomplete. Retry removal to finish reclaiming disk space.', { cause: error });
			}
		}
	}
}
