import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { operationFields, parameterFields, resourceField } from './shared/descriptions';
import { fxmdRequest, fxmdRequestAllRows } from './shared/transport';

const toDate = (value: unknown): string => (value ? String(value).slice(0, 10) : '');

const enc = encodeURIComponent;

export class FxMacroData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FXMacroData',
		name: 'fxMacroData',
		icon: { light: 'file:../../icons/fxmacrodata.svg', dark: 'file:../../icons/fxmacrodata.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Official macroeconomic releases, economic calendars, FX rates, COT positioning and commodities from FXMacroData',
		defaults: {
			name: 'FXMacroData',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'fxMacroDataApi',
				required: false,
			},
		],
		properties: [
			{
				displayName:
					'USD data, the data catalogue, market sessions and risk sentiment work without an API key. Other currencies, FX rates and commodities need an FXMacroData API key.',
				name: 'accessNotice',
				type: 'notice',
				default: '',
			},
			resourceField,
			...operationFields,
			...parameterFields,
		],
	};

	methods = {
		loadOptions: {
			async getIndicators(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const currency = String(this.getCurrentNodeParameter('currency') ?? 'USD');
				const catalogue = await fxmdRequest.call(this, `/v1/data_catalogue/${enc(currency)}`);
				return Object.entries(catalogue)
					.filter(([, entry]) => entry && typeof entry === 'object')
					.map(([slug, entry]) => {
						const item = entry as IDataObject;
						const detail = [item.unit, item.frequency].filter(Boolean).join(', ');
						return {
							name: `${(item.name as string) || slug} (${slug})`,
							value: slug,
							description: detail || undefined,
						};
					})
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const output = this.getNodeParameter('output', i, 'rows') as string;

				const paged = async (path: string, qs: IDataObject, pageSize = 100) => {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
					return fxmdRequestAllRows.call(this, path, qs, returnAll, limit, pageSize);
				};
				const dates = (): IDataObject => ({
					start_date: toDate(this.getNodeParameter('startDate', i, '')),
					end_date: toDate(this.getNodeParameter('endDate', i, '')),
				});

				let response: IDataObject;
				let rows: IDataObject[] | undefined;
				// Series-level fields copied onto each row so a row still says what it is.
				let context: IDataObject = {};

				if (resource === 'announcement' && operation === 'getHistory') {
					const currency = this.getNodeParameter('currency', i) as string;
					const indicator = this.getNodeParameter('indicator', i) as string;
					const result = await paged(`/v1/announcements/${enc(currency)}/${enc(indicator)}`, dates());
					response = { ...result.first, data: result.rows };
					rows = result.rows;
					context = { currency, indicator };
				} else if (resource === 'announcement' && operation === 'getLatest') {
					const currency = this.getNodeParameter('currency', i) as string;
					response = await fxmdRequest.call(this, `/v1/announcements/${enc(currency)}/latest`);
					context = { currency };
				} else if (resource === 'calendar') {
					const currency = this.getNodeParameter('currency', i) as string;
					const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
					response = await fxmdRequest.call(this, `/v1/calendar/${enc(currency)}`, {
						indicator: fields.indicator,
						start_date: toDate(fields.startDate),
						end_date: toDate(fields.endDate),
						timezone: fields.timezone,
					});
					context = { currency };
				} else if (resource === 'forex') {
					const base = this.getNodeParameter('base', i) as string;
					const quote = this.getNodeParameter('quote', i) as string;
					const result = await paged(`/v1/forex/${enc(base)}/${enc(quote)}`, dates());
					response = { ...result.first, data: result.rows };
					rows = result.rows;
					context = { base, quote };
				} else if (resource === 'cot') {
					const currency = this.getNodeParameter('currency', i) as string;
					const report = this.getNodeParameter('report', i) as string;
					const result = await paged(`/v1/cot/${enc(currency)}`, { ...dates(), report });
					response = { ...result.first, data: result.rows };
					rows = result.rows;
					context = { currency, report };
				} else if (resource === 'commodity' && operation === 'getHistory') {
					const commodity = this.getNodeParameter('commodity', i) as string;
					const result = await paged(`/v1/commodities/${enc(commodity)}`, dates());
					response = { ...result.first, data: result.rows };
					rows = result.rows;
					context = { indicator: commodity };
				} else if (resource === 'commodity' && operation === 'getLatest') {
					response = await fxmdRequest.call(this, '/v1/commodities/latest');
				} else if (resource === 'catalogue') {
					const currency = this.getNodeParameter('currency', i) as string;
					response = await fxmdRequest.call(this, `/v1/data_catalogue/${enc(currency)}`);
					rows = Object.entries(response)
						.filter(([, entry]) => entry && typeof entry === 'object' && !Array.isArray(entry))
						.map(([indicator, entry]) => ({ indicator, ...(entry as IDataObject) }));
					context = { currency };
				} else if (resource === 'marketSession') {
					response = await fxmdRequest.call(this, '/v1/market_sessions');
					rows = [response];
				} else if (resource === 'pressRelease') {
					const currency = this.getNodeParameter('currency', i) as string;
					const result = await paged(`/v1/press-releases/${enc(currency)}`, {}, 50);
					response = { ...result.first, data: result.rows };
					rows = result.rows;
					context = { currency };
				} else if (resource === 'riskSentiment') {
					const result = await paged('/v1/risk_sentiment', dates());
					response = { ...result.first, data: result.rows };
					rows = result.rows;
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}

				if (output === 'response') {
					returnData.push({ json: response, pairedItem: { item: i } });
					continue;
				}

				const rowList =
					rows ?? (Array.isArray(response.data) ? (response.data as IDataObject[]) : [response]);
				for (const row of rowList) {
					returnData.push({ json: { ...context, ...row }, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
