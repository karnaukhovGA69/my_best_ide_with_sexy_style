/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import type { Event } from '../../../../base/common/event.js';
import type { IDisposable } from '../../../../base/common/lifecycle.js';
import type { ILogger } from '../../../../platform/log/common/log.js';
import type { MCP } from './modelContextProtocol.js';

/** Type-only contract for remaining consumers. The MCP request handler runtime has been removed. */
export interface McpServerRequestHandler extends IDisposable {
	set roots(roots: MCP.Root[]);
	readonly capabilities: MCP.ServerCapabilities;
	readonly serverInfo: MCP.Implementation;
	readonly serverInstructions: string | undefined;
	readonly logger: ILogger;
	readonly onDidReceiveCancelledNotification: Event<MCP.CancelledNotification>;
	readonly onDidReceiveProgressNotification: Event<MCP.ProgressNotification>;
	readonly onDidReceiveElicitationCompleteNotification: Event<MCP.ElicitationCompleteNotification>;
	readonly onDidChangeResourceList: Event<void>;
	readonly onDidUpdateResource: Event<MCP.ResourceUpdatedNotification>;
	readonly onDidChangeToolList: Event<void>;
	readonly onDidChangePromptList: Event<void>;

	initialize(params: MCP.InitializeRequest['params'], token?: CancellationToken): Promise<MCP.InitializeResult>;
	listResources(params?: MCP.ListResourcesRequest['params'], token?: CancellationToken): Promise<MCP.Resource[]>;
	listResourcesIterable(params?: MCP.ListResourcesRequest['params'], token?: CancellationToken): AsyncIterable<MCP.Resource[]>;
	readResource(params: MCP.ReadResourceRequest['params'], token?: CancellationToken): Promise<MCP.ReadResourceResult>;
	listResourceTemplates(params?: MCP.ListResourceTemplatesRequest['params'], token?: CancellationToken): Promise<MCP.ResourceTemplate[]>;
	subscribe(params: MCP.SubscribeRequest['params'], token?: CancellationToken): Promise<MCP.EmptyResult>;
	unsubscribe(params: MCP.UnsubscribeRequest['params'], token?: CancellationToken): Promise<MCP.EmptyResult>;
	listPrompts(params?: MCP.ListPromptsRequest['params'], token?: CancellationToken): Promise<MCP.Prompt[]>;
	getPrompt(params: MCP.GetPromptRequest['params'], token?: CancellationToken): Promise<MCP.GetPromptResult>;
	listTools(params?: MCP.ListToolsRequest['params'], token?: CancellationToken): Promise<MCP.Tool[]>;
	callTool(params: MCP.CallToolRequest['params'] & MCP.Request['params'], token?: CancellationToken, onStatusMessage?: (message: string) => void): Promise<MCP.CallToolResult>;
	setLevel(params: MCP.SetLevelRequest['params'], token?: CancellationToken): Promise<MCP.EmptyResult>;
	complete(params: MCP.CompleteRequest['params'], token?: CancellationToken): Promise<MCP.CompleteResult>;
	getTask(params: { taskId: string }, token?: CancellationToken): Promise<MCP.GetTaskResult>;
	getTaskResult(params: { taskId: string }, token?: CancellationToken): Promise<MCP.GetTaskPayloadResult>;
	cancelTask(params: { taskId: string }, token?: CancellationToken): Promise<MCP.CancelTaskResult>;
	listTasks(params?: MCP.ListTasksRequest['params'], token?: CancellationToken): Promise<MCP.Task[]>;
}
