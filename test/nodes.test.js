// Offline tests for the compiled nodes. Run `npm run build` first.
// n8n-workflow is a peer dependency provided by n8n at runtime, so the few
// runtime values the nodes import are stubbed here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const stubPath = path.join(__dirname, 'n8n-workflow-stub.js');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
	if (request === 'n8n-workflow') return stubPath;
	return originalResolve.call(this, request, ...rest);
};

const dist = path.join(__dirname, '..', 'dist');
const { FxMacroData } = require(path.join(dist, 'nodes/FxMacroData/FxMacroData.node.js'));
const { FxMacroDataTrigger } = require(
	path.join(dist, 'nodes/FxMacroDataTrigger/FxMacroDataTrigger.node.js'),
);
const { FxMacroDataApi } = require(path.join(dist, 'credentials/FxMacroDataApi.credentials.js'));

function fakeContext({ params, responses, withCredential = true, mode = 'trigger', staticData }) {
	const calls = [];
	const respond = (options) => {
		calls.push({ ...options, authenticated: withCredential });
		const key = `${options.url}?${new URLSearchParams(options.qs).toString()}`;
		const match = responses.find((r) => r.match(key));
		if (!match) throw new Error(`unexpected request ${key}`);
		return match.body;
	};
	const node = {
		name: 'FXMacroData',
		credentials: withCredential ? { fxMacroDataApi: { id: '1', name: 'key' } } : undefined,
	};
	return {
		calls,
		ctx: {
			getNode: () => node,
			getInputData: () => [{ json: {} }],
			getNodeParameter: (name, _i, fallback) => {
				const value = params[name];
				if (value === undefined) return typeof _i === 'number' ? fallback : _i;
				return value;
			},
			getCurrentNodeParameter: (name) => params[name],
			continueOnFail: () => false,
			getMode: () => mode,
			getWorkflowStaticData: () => staticData,
			helpers: {
				httpRequest: async (options) => respond(options),
				httpRequestWithAuthentication: async (_cred, options) => respond(options),
				returnJsonArray: (rows) => rows.map((json) => ({ json })),
			},
		},
	};
}

test('credential sends the key in the X-API-Key header and tests a key-gated endpoint', () => {
	const cred = new FxMacroDataApi();
	assert.equal(cred.authenticate.properties.headers['X-API-Key'], '={{$credentials.apiKey}}');
	assert.equal(cred.test.request.baseURL, 'https://api.fxmacrodata.com');
	assert.equal(cred.test.request.url, '/v1/forex/EUR/USD');
});

test('every resource has an operation selector and every operation has an action', () => {
	const { properties } = new FxMacroData().description;
	const resources = properties.find((p) => p.name === 'resource').options.map((o) => o.value);
	for (const resource of resources) {
		const selector = properties.find(
			(p) => p.name === 'operation' && p.displayOptions.show.resource.includes(resource),
		);
		assert.ok(selector, `no operation for ${resource}`);
		for (const option of selector.options) assert.ok(option.action, `${resource}.${option.value}`);
	}
});

test('announcement history pages through next_offset and labels each row', async () => {
	const page = (rows, hasMore, next) => ({
		currency: 'USD',
		indicator: 'inflation',
		data: rows,
		pagination: { has_more: hasMore, next_offset: next },
	});
	const { ctx, calls } = fakeContext({
		params: {
			resource: 'announcement',
			operation: 'getHistory',
			currency: 'USD',
			indicator: 'inflation',
			startDate: '2024-01-01T00:00:00.000Z',
			endDate: '',
			returnAll: true,
			output: 'rows',
		},
		responses: [
			{ match: (k) => k.includes('offset=0'), body: page([{ date: '2024-01-01', val: 3.1 }], true, 100) },
			{ match: (k) => k.includes('offset=100'), body: page([{ date: '2024-02-01', val: 3.2 }], false, null) },
		],
	});
	const [items] = await new FxMacroData().execute.call(ctx);
	assert.equal(items.length, 2);
	assert.deepEqual(items[1].json, { currency: 'USD', indicator: 'inflation', date: '2024-02-01', val: 3.2 });
	assert.equal(calls[0].url, 'https://api.fxmacrodata.com/v1/announcements/USD/inflation');
	assert.equal(calls[0].qs.start_date, '2024-01-01');
	assert.equal('end_date' in calls[0].qs, false);
	assert.equal(calls[0].authenticated, true);
});

test('limit stops paging and the request works without a credential', async () => {
	const { ctx, calls } = fakeContext({
		withCredential: false,
		params: {
			resource: 'forex',
			operation: 'getRates',
			base: 'EUR',
			quote: 'USD',
			returnAll: false,
			limit: 2,
			output: 'rows',
		},
		responses: [
			{
				match: () => true,
				body: { data: [{ date: 'a' }, { date: 'b' }], pagination: { has_more: true, next_offset: 2 } },
			},
		],
	});
	const [items] = await new FxMacroData().execute.call(ctx);
	assert.equal(items.length, 2);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].qs.limit, 2);
	assert.equal(calls[0].authenticated, false);
});

test('data catalogue becomes one item per indicator and feeds the indicator list', async () => {
	const catalogue = {
		inflation: { name: 'Inflation (CPI)', unit: '%YoY', frequency: 'Monthly' },
		gdp: { name: 'GDP', unit: '%QoQ', frequency: 'Quarterly' },
	};
	const { ctx } = fakeContext({
		params: { resource: 'catalogue', operation: 'getIndicators', currency: 'AUD', output: 'rows' },
		responses: [{ match: (k) => k.includes('/v1/data_catalogue/AUD'), body: catalogue }],
	});
	const [items] = await new FxMacroData().execute.call(ctx);
	assert.deepEqual(items.map((i) => i.json.indicator).sort(), ['gdp', 'inflation']);

	const options = await new FxMacroData().methods.loadOptions.getIndicators.call(ctx);
	assert.deepEqual(options[0], { name: 'GDP (gdp)', value: 'gdp', description: '%QoQ, Quarterly' });
});

test('trigger starts from activation, then emits new releases and advances the cursor', async () => {
	const staticData = {};
	const params = { currencies: ['USD', 'EUR'], indicators: 'inflation, policy_rate', payload: 'compact' };
	const first = fakeContext({
		params,
		staticData,
		responses: [{ match: () => true, body: { data: [], next_cursor: 'c1', has_more: false } }],
	});
	assert.equal(await new FxMacroDataTrigger().poll.call(first.ctx), null);
	assert.equal(staticData.cursor, 'c1');
	assert.equal(first.calls[0].qs.currencies, 'USD,EUR');
	assert.equal(first.calls[0].qs.indicators, 'inflation,policy_rate');

	const second = fakeContext({
		params,
		staticData,
		responses: [
			{
				match: (k) => k.includes('since=c1'),
				body: { data: [{ event_id: 'e1', currency: 'USD', indicator: 'inflation' }], next_cursor: 'c2', has_more: false },
			},
		],
	});
	const result = await new FxMacroDataTrigger().poll.call(second.ctx);
	assert.equal(result[0][0].json.event_id, 'e1');
	assert.equal(staticData.cursor, 'c2');
});

test('manual trigger run returns recent sample releases without moving the cursor', async () => {
	const staticData = { cursor: 'keep' };
	const { ctx, calls } = fakeContext({
		mode: 'manual',
		params: { currencies: [], indicators: '', payload: 'full' },
		staticData,
		responses: [{ match: () => true, body: { data: [{ event_id: 'e9' }], next_cursor: 'zz', has_more: true } }],
	});
	const result = await new FxMacroDataTrigger().poll.call(ctx);
	assert.equal(result[0].length, 1);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].qs.currencies, 'all');
	assert.equal(staticData.cursor, 'keep');
});
