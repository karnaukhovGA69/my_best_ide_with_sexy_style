/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { upcast } from '../../../../../base/common/types.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestLoggerService, TestProductService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IMcpHostDelegate } from '../../common/mcpRegistryTypes.js';
import { McpServerRequestHandler, McpTask } from '../../common/mcpServerRequestHandler.js';
import { McpConnectionState, McpError, McpServerDefinition, McpServerLaunch } from '../../common/mcpTypes.js';
import { MCP } from '../../common/modelContextProtocol.js';
import { TestMcpMessageTransport } from './mcpRegistryTypes.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { McpTaskManager } from '../../common/mcpTaskManager.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';

class TestMcpHostDelegate extends Disposable implements IMcpHostDelegate {
	private readonly _transport: TestMcpMessageTransport;

	priority = 0;
	resolvePolicyVariables = async () => ({});

	constructor() {
		super();
		this._transport = this._register(new TestMcpMessageTransport());
	}


	substituteVariables(serverDefinition: McpServerDefinition, launch: McpServerLaunch): Promise<McpServerLaunch> {
		return Promise.resolve(launch);
	}

	expandEnvironmentVariables(serverDefinition: McpServerDefinition, launch: McpServerLaunch): Promise<McpServerLaunch> {
		return Promise.resolve(launch);
	}

	canStart(): boolean {
		return true;
	}

	start(): TestMcpMessageTransport {
		return this._transport;
	}

	getTransport(): TestMcpMessageTransport {
		return this._transport;
	}

	waitForInitialProviderPromises(): Promise<void> {
		return Promise.resolve();
	}
}

suite('Workbench - MCP - ServerRequestHandler', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let delegate: TestMcpHostDelegate;
	let transport: TestMcpMessageTransport;
	let handler: McpServerRequestHandler;
	let cts: CancellationTokenSource;

	setup(async () => {
		delegate = store.add(new TestMcpHostDelegate());
		transport = delegate.getTransport();
		cts = store.add(new CancellationTokenSource());

		// Setup test services
		const services = new ServiceCollection(
			[ILoggerService, store.add(new TestLoggerService())],
			[IOutputService, upcast({ showChannel: () => { } })],
			[IStorageService, store.add(new TestStorageService())],
			[IProductService, TestProductService],
		);

		instantiationService = store.add(new TestInstantiationService(services));

		transport.setConnectionState({ state: McpConnectionState.Kind.Running });

		// Manually create the handler since we need the transport already set up
		const logger = store.add((instantiationService.get(ILoggerService) as TestLoggerService)
			.createLogger('mcpServerTest', { hidden: true, name: 'MCP Test' }));

		// Start the handler creation
		const handlerPromise = McpServerRequestHandler.create(instantiationService, { logger, launch: transport, taskManager: store.add(new McpTaskManager()) }, cts.token);

		handler = await handlerPromise;
		store.add(handler);
	});

	test('should send and receive JSON-RPC requests', async () => {
		// Setup request
		const requestPromise = handler.listResources();

		// Get the sent message and verify it
		const sentMessages = transport.getSentMessages();
		assert.strictEqual(sentMessages.length, 3); // initialize + listResources

		// Verify listResources request format
		const listResourcesRequest = sentMessages[2] as MCP.JSONRPCRequest;
		assert.strictEqual(listResourcesRequest.method, 'resources/list');
		assert.strictEqual(listResourcesRequest.jsonrpc, MCP.JSONRPC_VERSION);
		assert.ok(typeof listResourcesRequest.id === 'number');

		// Simulate server response with mock resources that match the expected Resource interface
		transport.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: listResourcesRequest.id,
			result: {
				resources: [
					{ uri: 'resource1', type: 'text/plain', name: 'Test Resource 1' },
					{ uri: 'resource2', type: 'text/plain', name: 'Test Resource 2' }
				]
			}
		});

		// Verify the result
		const resources = await requestPromise;
		assert.strictEqual(resources.length, 2);
		assert.strictEqual(resources[0].uri, 'resource1');
		assert.strictEqual(resources[1].name, 'Test Resource 2');
	});

	test('should handle paginated requests', async () => {
		// Setup request
		const requestPromise = handler.listResources();

		// Get the first request and respond with pagination
		const sentMessages = transport.getSentMessages();
		const listResourcesRequest = sentMessages[2] as MCP.JSONRPCRequest;

		// Send first page with nextCursor
		transport.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: listResourcesRequest.id,
			result: {
				resources: [
					{ uri: 'resource1', type: 'text/plain', name: 'Test Resource 1' }
				],
				nextCursor: 'page2'
			}
		});

		// Clear the sent messages to only capture the next page request
		transport.clearSentMessages();

		// Wait a bit to allow the handler to process and send the next request
		await new Promise(resolve => setTimeout(resolve, 0));

		// Get the second request and verify cursor is included
		const sentMessages2 = transport.getSentMessages();
		assert.strictEqual(sentMessages2.length, 1);

		const listResourcesRequest2 = sentMessages2[0] as MCP.JSONRPCRequest;
		assert.strictEqual(listResourcesRequest2.method, 'resources/list');
		assert.deepStrictEqual(listResourcesRequest2.params, { cursor: 'page2' });

		// Send final page with no nextCursor
		transport.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: listResourcesRequest2.id,
			result: {
				resources: [
					{ uri: 'resource2', type: 'text/plain', name: 'Test Resource 2' }
				]
			}
		});

		// Verify the combined result
		const resources = await requestPromise;
		assert.strictEqual(resources.length, 2);
		assert.strictEqual(resources[0].uri, 'resource1');
		assert.strictEqual(resources[1].uri, 'resource2');
	});

	test('should handle error responses', async () => {
		// Setup request
		const requestPromise = handler.readResource({ uri: 'non-existent' });

		// Get the sent message
		const sentMessages = transport.getSentMessages();
		const readResourceRequest = sentMessages[2] as MCP.JSONRPCRequest; // [0] is initialize

		// Simulate error response
		transport.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: readResourceRequest.id,
			error: {
				code: MCP.METHOD_NOT_FOUND,
				message: 'Resource not found'
			}
		});

		// Verify the error is thrown correctly
		try {
			await requestPromise;
			assert.fail('Expected error was not thrown');
		} catch (e: unknown) {
			assert.strictEqual((e as Error).message, 'MPC -32601: Resource not found');
			assert.strictEqual((e as { code: number }).code, MCP.METHOD_NOT_FOUND);
		}
	});

	test('should handle server requests', async () => {
		// Simulate ping request from server
		const pingRequest: MCP.JSONRPCRequest & MCP.PingRequest = {
			jsonrpc: MCP.JSONRPC_VERSION,
			id: 100,
			method: 'ping'
		};

		transport.simulateReceiveMessage(pingRequest);

		// The handler should have sent a response
		const sentMessages = transport.getSentMessages();
		const pingResponse = sentMessages.find(m =>
			'id' in m && m.id === pingRequest.id && 'result' in m
		) as MCP.JSONRPCResultResponse;

		assert.ok(pingResponse, 'No ping response was sent');
		assert.deepStrictEqual(pingResponse.result, {});
	});

	test('should handle roots list requests', async () => {
		// Set roots
		handler.roots = [
			{ uri: 'file:///test/root1', name: 'Root 1' },
			{ uri: 'file:///test/root2', name: 'Root 2' }
		];

		// Simulate roots/list request from server
		const rootsRequest: MCP.JSONRPCRequest & MCP.ListRootsRequest = {
			jsonrpc: MCP.JSONRPC_VERSION,
			id: 101,
			method: 'roots/list'
		};

		transport.simulateReceiveMessage(rootsRequest);

		// The handler should have sent a response
		const sentMessages = transport.getSentMessages();
		const rootsResponse = sentMessages.find(m =>
			'id' in m && m.id === rootsRequest.id && 'result' in m
		) as MCP.JSONRPCResultResponse;

		assert.ok(rootsResponse, 'No roots/list response was sent');
		assert.strictEqual((rootsResponse.result as MCP.ListRootsResult).roots.length, 2);
		assert.strictEqual((rootsResponse.result as MCP.ListRootsResult).roots[0].uri, 'file:///test/root1');
	});

	test('should handle server notifications', async () => {
		let progressNotificationReceived = false;
		store.add(handler.onDidReceiveProgressNotification(notification => {
			progressNotificationReceived = true;
			assert.strictEqual(notification.method, 'notifications/progress');
			assert.strictEqual(notification.params.progressToken, 'token1');
			assert.strictEqual(notification.params.progress, 50);
		}));

		// Simulate progress notification with correct format
		const progressNotification: MCP.JSONRPCNotification & MCP.ProgressNotification = {
			jsonrpc: MCP.JSONRPC_VERSION,
			method: 'notifications/progress',
			params: {
				progressToken: 'token1',
				progress: 50,
				total: 100
			}
		};

		transport.simulateReceiveMessage(progressNotification);
		assert.strictEqual(progressNotificationReceived, true);
	});

	test('should handle cancellation', async () => {
		// Setup a new cancellation token source for this specific test
		const testCts = store.add(new CancellationTokenSource());
		const requestPromise = handler.listResources(undefined, testCts.token);

		// Get the request ID
		const sentMessages = transport.getSentMessages();
		const listResourcesRequest = sentMessages[2] as MCP.JSONRPCRequest;
		const requestId = listResourcesRequest.id;

		// Cancel the request
		testCts.cancel();

		// Check that a cancellation notification was sent
		const cancelNotification = transport.getSentMessages().find(m =>
			!('id' in m) &&
			'method' in m &&
			m.method === 'notifications/cancelled' &&
			'params' in m &&
			m.params && m.params.requestId === requestId
		);

		assert.ok(cancelNotification, 'No cancellation notification was sent');

		// Verify the promise was cancelled
		try {
			await requestPromise;
			assert.fail('Promise should have been cancelled');
		} catch (e) {
			assert.strictEqual(e.name, 'Canceled');
		}
	});

	test('should handle cancelled notification from server', async () => {
		// Setup request
		const requestPromise = handler.listResources();

		// Get the request ID
		const sentMessages = transport.getSentMessages();
		const listResourcesRequest = sentMessages[2] as MCP.JSONRPCRequest;
		const requestId = listResourcesRequest.id;

		// Simulate cancelled notification from server
		const cancelledNotification: MCP.JSONRPCNotification & MCP.CancelledNotification = {
			jsonrpc: MCP.JSONRPC_VERSION,
			method: 'notifications/cancelled',
			params: {
				requestId
			}
		};

		transport.simulateReceiveMessage(cancelledNotification);

		// Verify the promise was cancelled
		try {
			await requestPromise;
			assert.fail('Promise should have been cancelled');
		} catch (e) {
			assert.strictEqual(e.name, 'Canceled');
		}
	});

	test('should dispose properly and cancel pending requests', async () => {
		// Setup multiple requests
		const request1 = handler.listResources();
		const request2 = handler.listTools();

		// Dispose the handler
		handler.dispose();

		// Verify all promises were cancelled
		try {
			await request1;
			assert.fail('Promise 1 should have been cancelled');
		} catch (e) {
			assert.strictEqual(e.name, 'Canceled');
		}

		try {
			await request2;
			assert.fail('Promise 2 should have been cancelled');
		} catch (e) {
			assert.strictEqual(e.name, 'Canceled');
		}
	});

	test('should handle connection error by cancelling requests', async () => {
		// Setup request
		const requestPromise = handler.listResources();

		// Simulate connection error
		transport.setConnectionState({
			state: McpConnectionState.Kind.Error,
			message: 'Connection lost'
		});

		// Verify the promise was cancelled
		try {
			await requestPromise;
			assert.fail('Promise should have been cancelled');
		} catch (e) {
			assert.strictEqual(e.name, 'Canceled');
		}
	});

	test('callTool forwards _meta.traceparent to the JSON-RPC payload (MCP SEP-414)', async () => {
		const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
		const tracestate = 'rojo=00f067aa0ba902b7';

		const callPromise = handler.callTool({
			name: 'echo',
			arguments: { hello: 'world' },
			_meta: { traceparent, tracestate, progressToken: 'tok-1' },
		});

		const sentMessages = transport.getSentMessages();
		const callRequest = sentMessages[2] as MCP.JSONRPCRequest & MCP.CallToolRequest;
		assert.strictEqual(callRequest.method, 'tools/call');
		assert.deepStrictEqual(callRequest.params._meta, {
			traceparent,
			tracestate,
			progressToken: 'tok-1',
		});

		transport.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: callRequest.id,
			result: { content: [] },
		});

		await callPromise;
	});
	test('task-augmented tool response rejects without polling or waiting for task completion', async () => {
		const call = handler.callTool({ name: 'test' });
		const response = call.then(() => undefined, error => error);
		const request = transport.getSentMessages()[2] as MCP.JSONRPCRequest;
		transport.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: request.id,
			result: { task: { taskId: 'test', status: 'working', ttl: 1000, pollInterval: 1, createdAt: '', lastUpdatedAt: '' } },
		});
		const error = await response;
		assert.ok(error instanceof McpError);
		assert.strictEqual(error.code, -32000);
		assert.strictEqual(transport.getSentMessages().length, 3);
	});

});

suite('Workbench - MCP - client task implementation removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function taskData(status: MCP.TaskStatus = 'working'): MCP.Task {
		return { taskId: 'test', status, ttl: 1000, pollInterval: 1, createdAt: '', lastUpdatedAt: '' };
	}

	async function resultError(task: McpTask<MCP.Result>) {
		try {
			await task.result;
			return undefined;
		} catch (error) {
			if (!(error instanceof McpError)) {
				throw error;
			}
			return { code: error.code, message: error.message };
		}
	}

	for (const status of ['working', 'input_required', 'completed', 'failed', 'cancelled'] as const) {
		test(`result is unavailable for ${status} without using a handler`, async () => {
			const task = store.add(new McpTask(taskData(status), CancellationToken.Cancelled));
			const handler = new Proxy(upcastPartial<McpServerRequestHandler>({}), { get() { throw new Error('Handler accessed'); } });
			task.setHandler(handler);
			task.onDidUpdateState(taskData('completed'));
			assert.deepStrictEqual(await resultError(task), { code: -32000, message: 'MCP client tasks are disabled in Myself IDE.' });
			assert.strictEqual(task.result, task.result);
			assert.strictEqual(task.id, 'test');
		});
	}

	test('constructor and notifications do not inspect inputs or allocate timers', async () => {
		const clock = sinon.useFakeTimers();
		try {
			const data = new Proxy(upcastPartial<MCP.Task>({}), { get() { throw new Error('Task data read'); } });
			const token = new Proxy(upcastPartial<CancellationToken>({}), { get() { throw new Error('Token read'); } });
			const task = store.add(new McpTask(data, token, () => { throw new Error('Status callback invoked'); }));
			task.onDidUpdateState(data);
			task.setHandler(undefined);
			await clock.tickAsync(60000);
			assert.strictEqual(clock.countTimers(), 0);
			task.dispose();
			task.dispose();
			assert.deepStrictEqual(await resultError(task), { code: -32000, message: 'MCP client tasks are disabled in Myself IDE.' });
		} finally {
			clock.restore();
		}
	});
});
