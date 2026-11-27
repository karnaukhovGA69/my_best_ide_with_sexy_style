/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { URI } from '../../../../base/common/uri.js';

type RootMarker = 'pyproject.toml' | 'requirements.txt' | '.venv' | 'CMakeLists.txt' | 'Makefile' | 'compile_commands.json';
type RootMarkerObservation = 'file' | 'directory' | 'absent' | 'unknown' | 'unverified-link';
type RootMarkerStatus = 'present' | 'absent' | 'unknown' | 'wrong-type' | 'unverified-link';
type InterpreterSettingSource = 'user' | 'workspace' | 'workspace-folder' | 'unknown';
type InterpreterPathPresence = 'present' | 'absent' | 'unknown';

/**
 * An explicit interpreter setting as observed for this resource. 'unset' means the
 * collector checked for an explicit setting. 'unresolved' covers values without a
 * known target, such as a bare command, unresolved variable, or ambiguous relative path.
 * Path presence describes the candidate interpreter file, even for a setting that
 * names an environment directory. It says nothing about executable validity or selection.
 */
type PythonInterpreterSnapshot =
	| { readonly kind: 'unset' }
	| { readonly kind: 'unresolved'; readonly source: InterpreterSettingSource }
	| { readonly kind: 'absolute'; readonly source: InterpreterSettingSource; readonly presence: InterpreterPathPresence }
	| { readonly kind: 'folder-relative'; readonly source: InterpreterSettingSource; readonly baseFolder: URI; readonly presence: InterpreterPathPresence };

/** Observations from the root of one workspace folder, identified by its workspace URI. */
interface FolderSnapshot {
	readonly folder: URI;
	/** Omitted facts are unknown. File and directory observations require a verified root entry of that type. */
	readonly markers?: Readonly<Partial<Record<RootMarker, RootMarkerObservation>>>;
	readonly pythonInterpreter?: PythonInterpreterSnapshot;
}

export interface ProjectReadinessSnapshot {
	readonly isTrusted: boolean;
	readonly folders: readonly FolderSnapshot[];
}

type InterpreterAssessment =
	| { readonly kind: 'unset' | 'unknown' }
	| { readonly kind: 'unresolved' | 'different-folder'; readonly source: InterpreterSettingSource }
	| { readonly kind: 'absolute' | 'folder-relative'; readonly source: InterpreterSettingSource; readonly presence: InterpreterPathPresence };

/** Apply the expected entry type and preserve uncertainty about unchecked facts or links. */
function assessMarker(markers: FolderSnapshot['markers'], name: RootMarker, expectedType: 'file' | 'directory'): RootMarkerStatus {
	const observation = markers?.[name];
	switch (observation) {
		case 'file':
		case 'directory':
			return observation === expectedType ? 'present' : 'wrong-type';
		case 'absent':
		case 'unverified-link':
			return observation;
		default:
			return 'unknown';
	}
}

/** Only use a relative candidate's presence fact for the workspace folder it was checked against. */
function assessInterpreter(folder: URI, interpreter: PythonInterpreterSnapshot | undefined): InterpreterAssessment {
	switch (interpreter?.kind) {
		case 'unset':
			return { kind: 'unset' };
		case 'unresolved':
			return { kind: 'unresolved', source: interpreter.source };
		case 'absolute':
		case 'folder-relative':
			if (interpreter.kind === 'folder-relative' && interpreter.baseFolder.toString() !== folder.toString()) {
				return { kind: 'different-folder', source: interpreter.source };
			}
			return { kind: interpreter.kind, source: interpreter.source, presence: interpreter.presence };
		default:
			return { kind: 'unknown' };
	}
}

type ReviewTopic = 'python-interpreter' | 'c-build-configuration' | 'c-compilation-database';

/** Assess only local roots. A review topic describes evidence worth inspecting. */
function assessFolder({ folder, markers, pythonInterpreter }: FolderSnapshot) {
	if (folder.scheme !== 'file') {
		return { folder, kind: 'unsupported-root', reason: 'non-file-scheme' } as const;
	}
	if (folder.authority) {
		return { folder, kind: 'unsupported-root', reason: 'file-authority' } as const;
	}

	const pythonMarkers = {
		'pyproject.toml': assessMarker(markers, 'pyproject.toml', 'file'),
		'requirements.txt': assessMarker(markers, 'requirements.txt', 'file'),
		'.venv': assessMarker(markers, '.venv', 'directory'),
	};
	const buildMarkers = {
		'CMakeLists.txt': assessMarker(markers, 'CMakeLists.txt', 'file'),
		'Makefile': assessMarker(markers, 'Makefile', 'file'),
	};
	const compilationDatabase = assessMarker(markers, 'compile_commands.json', 'file');

	const review: ReviewTopic[] = [];
	if (Object.values(pythonMarkers).includes('present')) {
		review.push('python-interpreter');
	}
	if (Object.values(buildMarkers).includes('present')) {
		review.push('c-build-configuration');
	}
	if (compilationDatabase === 'present') {
		review.push('c-compilation-database');
	}

	return {
		folder,
		kind: 'local',
		python: { markers: pythonMarkers, interpreter: assessInterpreter(folder, pythonInterpreter) },
		c: { buildMarkers, compilationDatabase },
		review,
	} as const;
}

/**
 * Explain the supplied observations for each root. Review topics are advisory in
 * either trust state. An empty review list leaves language and tooling unconfirmed.
 */
export function evaluateProjectReadiness(snapshot: ProjectReadinessSnapshot) {
	return {
		execution: snapshot.isTrusted ? 'outside-assessment' : 'blocked-by-workspace-trust',
		folders: snapshot.folders.map(assessFolder),
	} as const;
}
