/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { loadWith } = require('./helpers.cts');
const { LocalHttpError, maxBodyBytes, prepareLocalRequest } = require('../out/model.js');
const { renderResponse } = require('../out/view.js');

const hasCode = code => error => error instanceof LocalHttpError && error.code === code;

function fixture() {
	const calls = [];
	const timers = new Map();
	function request(protocol) {
		return (options, respond) => {
			const stream = Object.assign(new EventEmitter(), {
				closed: false,
				payload: undefined,
				end(body) { stream.payload = body; },
				destroy() { stream.closed = true; },
			});
			calls.push({ protocol, options, respond, stream });
			return stream;
		};
	}
	const transport = loadWith('transport.js', {
		'node:http': { request: request('http:') },
		'node:https': { request: request('https:') },
		'node:timers': {
			setTimeout(callback, delay) {
				const marker = Symbol();
				timers.set(marker, { callback, delay });
				return marker;
			},
			clearTimeout(marker) { timers.delete(marker); },
		},
	});
	function reply(index, status) {
		const response = Object.assign(new EventEmitter(), {
			statusCode: status, closed: false,
			destroy() { response.closed = true; },
		});
		calls[index].respond(response);
		return response;
	}
	return { ...transport, calls, timers, reply };
}

test('normalizes the entered path and keeps queries out of confirmation', () => {
	const request = prepareLocalRequest('POST', 'https://[::1]:1443/one/../два?kind=sample', 'ю');
	assert.deepEqual(request, {
		method: 'POST',
		target: {
			protocol: 'https:', hostname: '::1', port: 1443,
			requestPath: '/%D0%B4%D0%B2%D0%B0?kind=sample',
			displayEndpoint: 'https://[::1]:1443/%D0%B4%D0%B2%D0%B0', hasQuery: true,
		},
		body: 'ю', bodyBytes: 2,
	});
	assert.equal(prepareLocalRequest('GET', 'http://127.0.0.1', 'ignored').target.port, 80);
	assert.equal(prepareLocalRequest('GET', 'https://[::1]', '').target.port, 443);
	assert.equal(prepareLocalRequest('GET', 'http://127.0.0.1', 'ignored').bodyBytes, 0);
});

test('accepts only the two literal loopback hosts, with a valid port and no credentials or fragment', () => {
	for (const url of [
		'http://localhost/', 'http://127.1/', 'http://127.0.0.2/', 'http://2130706433/',
		'http://%31%32%37.0.0.1/', 'http://127.0.0.1./', 'http://[::ffff:127.0.0.1]/',
		'http://127.0.0.1:0/', 'http://127.0.0.1:65536/', 'http://127.0.0.1:no/',
		'http://user:pass@127.0.0.1/', 'http://127.0.0.1/#part', 'ftp://127.0.0.1/',
		'http://127.0.0.1\\path', 'http://127.0.0.1/white space', 'http://127.0.0.1/line\nbreak',
	]) {
		assert.throws(() => prepareLocalRequest('GET', url, ''), hasCode('invalid-target'), url);
	}
	assert.throws(() => prepareLocalRequest('POST', 'http://127.0.0.1/', 'ю'.repeat(maxBodyBytes / 2 + 1)), hasCode('body-size'));
});

test('makes one direct request and returns a redirect response without following it', async () => {
	const app = fixture();
	const result = app.sendLocalRequest('GET', 'http://127.0.0.1:9090/first', 'not sent', new AbortController().signal);
	const [call] = app.calls;
	assert.deepEqual(call.options, {
		protocol: 'http:', hostname: '127.0.0.1', port: 9090, path: '/first', method: 'GET', agent: false,
		maxHeaderSize: app.maxResponseHeaderBytes, headers: { 'Accept-Encoding': 'identity', Connection: 'close' },
	});
	assert.equal(call.stream.payload, undefined);
	const response = app.reply(0, 302);
	response.headers = { location: 'http://127.0.0.1:9090/other' };
	response.emit('data', Buffer.from('moved'));
	response.emit('end');
	assert.deepEqual(await result, { status: 302, text: 'moved', truncated: false });
	assert.equal(app.calls.length, 1);
	assert.equal(app.timers.size, 0);
	assert.equal(call.stream.closed, true);
});

test('sets explicit TLS verification and limits the response while preserving its status', async () => {
	const app = fixture();
	const result = app.sendLocalRequest('POST', 'https://[::1]:9443/submit', 'ю', new AbortController().signal);
	const [call] = app.calls;
	assert.equal(call.protocol, 'https:');
	assert.equal(call.options.hostname, '::1');
	assert.equal(call.options.rejectUnauthorized, true);
	assert.equal(call.options.agent, false);
	assert.deepEqual(call.options.headers, {
		'Accept-Encoding': 'identity', Connection: 'close', 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': 2,
	});
	assert.equal(call.stream.payload.toString('utf8'), 'ю');
	const response = app.reply(0, 201);
	response.emit('data', Buffer.from('start'));
	response.emit('data', Buffer.alloc(app.maxResponseBytes, 'x'));
	const output = await result;
	assert.deepEqual(output, { status: 201, text: 'start' + 'x'.repeat(app.maxResponseBytes - 5), truncated: true });
	assert.equal(response.closed, true);
	assert.equal(call.stream.closed, true);
	assert.equal(app.timers.size, 0);
});

test('refuses invalid and already cancelled requests before calling a transport', async () => {
	const app = fixture();
	const controller = new AbortController();
	await assert.rejects(app.sendLocalRequest('GET', 'http://example.invalid/', '', controller.signal), hasCode('invalid-target'));
	await assert.rejects(app.sendLocalRequest('PUT', 'http://127.0.0.1/', '', controller.signal), hasCode('invalid-method'));
	controller.abort();
	await assert.rejects(app.sendLocalRequest('GET', 'http://127.0.0.1/', '', controller.signal), hasCode('cancelled'));
	assert.equal(app.calls.length, 0);
});

test('cancellation and the absolute deadline close both sides without returning partial data', async () => {
	for (const code of ['cancelled', 'timeout']) {
		const app = fixture();
		const controller = new AbortController();
		const result = app.sendLocalRequest('GET', 'http://127.0.0.1/', '', controller.signal);
		const response = app.reply(0, 200);
		response.emit('data', Buffer.from('partial'));
		const [deadline] = app.timers.values();
		assert.equal(deadline.delay, app.requestTimeoutMs);
		if (code === 'cancelled') {
			controller.abort();
		} else {
			deadline.callback();
		}
		await assert.rejects(result, hasCode(code));
		assert.equal(app.calls[0].stream.closed, true);
		assert.equal(response.closed, true);
		assert.equal(app.timers.size, 0);
	}
});

test('response preview shows markup as text with no executable content or resource source', () => {
	const html = renderResponse('Response', 'HTTP status 200', 'text & <em>x</em>', 'Limited', 'en');
	assert.match(html, /<h1>HTTP status 200<\/h1><p>Limited<\/p><pre>text &amp; &lt;em&gt;x&lt;\/em&gt;<\/pre>/);
	assert.match(html, /default-src 'none'; style-src 'nonce-[A-Za-z0-9+/=]+'/);
	assert.doesNotMatch(html, /<em>|<script|<iframe|<a\s/);
});
