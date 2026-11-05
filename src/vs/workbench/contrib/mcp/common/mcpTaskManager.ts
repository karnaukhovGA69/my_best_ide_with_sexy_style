/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import type { McpServerRequestHandler } from './mcpServerRequestHandler.js';
import { McpError } from './mcpTypes.js';
import { MCP } from './modelContextProtocol.js';

export interface IMcpTaskInternal extends IDisposable {
	readonly id: string;
	onDidUpdateState(task: MCP.Task): void;
	setHandler(handler: McpServerRequestHandler | undefined): void;
}

/** Compatibility facade for disabled protocol tasks; unrelated to workbench Tasks. */
export class McpTaskManager extends Disposable {
	public readonly onDidUpdateTask: Event<MCP.Task> = Event.None;

	setHandler(_handler: McpServerRequestHandler | undefined): void { }

	getClientTask(_taskId: string): IMcpTaskInternal | undefined {
		return undefined;
	}

	adoptClientTask(task: IMcpTaskInternal): void {
		// The caller creates the task before adoption. Release its timers/listeners before refusing it.
		task.dispose();
		throw unavailable();
	}

	abandonClientTask(_taskId: string): void { }

	public createTask<TResult extends MCP.Result>(_ttl: number | null, _executor: (token: CancellationToken) => Promise<TResult>): MCP.CreateTaskResult {
		throw unavailable();
	}

	public getTask(_taskId: string): MCP.GetTaskResult {
		throw unavailable();
	}

	public async getTaskResult(_taskId: string): Promise<MCP.GetTaskPayloadResult> {
		throw unavailable();
	}

	public cancelTask(_taskId: string): MCP.CancelTaskResult {
		throw unavailable();
	}

	public listTasks(): MCP.ListTasksResult {
		return { tasks: [] };
	}
}

function unavailable(): McpError {
	return new McpError(-32000, localize('mcp.tasks.disabled', "MCP tasks are disabled in Myself IDE."));
}
