import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const BASE_URL = 'https://api.fxmacrodata.com';

type FxmdContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

/**
 * GET an FXMacroData endpoint.
 *
 * The credential is optional on the node: USD data, the data catalogue, market
 * sessions and risk sentiment are free without a key, so a workflow can run
 * before the user has subscribed. When a credential is attached, the key is
 * sent in the X-API-Key header.
 */
export async function fxmdRequest(
	this: FxmdContext,
	path: string,
	qs: IDataObject = {},
): Promise<IDataObject> {
	const query: IDataObject = {};
	for (const [key, value] of Object.entries(qs)) {
		if (value !== '' && value !== undefined && value !== null) query[key] = value;
	}

	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `${BASE_URL}${path}`,
		qs: query,
		json: true,
	};

	try {
		if (this.getNode().credentials?.fxMacroDataApi) {
			return (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'fxMacroDataApi',
				options,
			)) as IDataObject;
		}
		return (await this.helpers.httpRequest(options)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: describeError(error as JsonObject),
		});
	}
}

function describeError(error: JsonObject): string {
	const status = Number(
		(error.httpCode as string) ?? (error.statusCode as number) ?? (error.status as number),
	);
	if (status === 401 || status === 403) {
		return 'FXMacroData rejected the request. Non-USD data, FX rates and commodities need a paid API key: attach an FXMacroData API credential to this node.';
	}
	if (status === 404) {
		return 'FXMacroData has no data for this combination. Check the currency and indicator, or list the available indicators with the Data Catalogue resource.';
	}
	if (status === 429) {
		return 'FXMacroData rate limit reached. Slow the workflow down or retry later.';
	}
	return 'FXMacroData request failed';
}

/**
 * Fetch a paginated endpoint. The API pages with `limit`/`offset` and reports
 * `pagination.has_more` and `pagination.next_offset`.
 */
export async function fxmdRequestAllRows(
	this: IExecuteFunctions,
	path: string,
	qs: IDataObject,
	returnAll: boolean,
	limit: number,
	pageSize: number,
): Promise<{ first: IDataObject; rows: IDataObject[] }> {
	const rows: IDataObject[] = [];
	let offset = 0;
	let first: IDataObject | undefined;

	for (;;) {
		const remaining = returnAll ? pageSize : Math.min(pageSize, limit - rows.length);
		const page = await fxmdRequest.call(this, path, { ...qs, limit: remaining, offset });
		first = first ?? page;
		const data = Array.isArray(page.data) ? (page.data as IDataObject[]) : [];
		rows.push(...data);

		const pagination = (page.pagination ?? {}) as IDataObject;
		const nextOffset = pagination.next_offset as number | null | undefined;
		const hasMore = pagination.has_more === true && typeof nextOffset === 'number';
		if (!hasMore || data.length === 0) break;
		if (!returnAll && rows.length >= limit) break;
		offset = nextOffset;
	}

	return { first: first ?? {}, rows: returnAll ? rows : rows.slice(0, limit) };
}
