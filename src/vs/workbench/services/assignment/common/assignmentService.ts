/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAssignmentService } from '../../../../platform/assignment/common/assignment.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface IAssignmentFilter {
	readonly id: string;
	exclude(assignment: string): boolean;
	onDidChange: Event<void>;
}

export const IWorkbenchAssignmentService = createDecorator<IWorkbenchAssignmentService>('assignmentService');

export interface IWorkbenchAssignmentService extends IAssignmentService {
	getCurrentExperiments(): Promise<string[] | undefined>;
	addTelemetryAssignmentFilter(filter: IAssignmentFilter): void;
	getTreatmentWithAssignment<T extends string | number | boolean>(name: string): Promise<ITreatmentWithAssignment<T>>;
}

export interface ITreatmentWithAssignment<T extends string | number | boolean> {
	readonly value: T | undefined;
	readonly hasAssignment: Promise<boolean>;
}

/** This distribution uses local configuration defaults without remote or developer experiment assignments. */
export class WorkbenchAssignmentService extends Disposable implements IWorkbenchAssignmentService {
	declare readonly _serviceBrand: undefined;
	readonly onDidRefetchAssignments = Event.None;

	async getTreatment<T extends string | number | boolean>(_name: string): Promise<T | undefined> {
		return undefined;
	}

	async getTreatmentWithAssignment<T extends string | number | boolean>(_name: string): Promise<ITreatmentWithAssignment<T>> {
		return { value: undefined, hasAssignment: Promise.resolve(false) };
	}

	async getCurrentExperiments(): Promise<string[]> {
		return [];
	}

	addTelemetryAssignmentFilter(_filter: IAssignmentFilter): void { }
}

registerSingleton(IWorkbenchAssignmentService, WorkbenchAssignmentService, InstantiationType.Delayed);
