import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { CURRENCIES } from '../FxMacroData/shared/descriptions';
import { fxmdRequest } from '../FxMacroData/shared/transport';

const MAX_PAGES_PER_POLL = 10;
const MANUAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export class FxMacroDataTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FXMacroData Trigger',
		name: 'fxMacroDataTrigger',
		icon: { light: 'file:../../icons/fxmacrodata.svg', dark: 'file:../../icons/fxmacrodata.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'New economic release',
		description: 'Starts the workflow when FXMacroData records a new economic release',
		defaults: {
			name: 'FXMacroData Trigger',
		},
		polling: true,
		inputs: [],
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
					'Without an API key this trigger only sees USD releases, 15 minutes after publication. Attach an FXMacroData API key for every currency in real time.',
				name: 'accessNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Currencies',
				name: 'currencies',
				type: 'multiOptions',
				options: CURRENCIES,
				default: [],
				description: 'Only trigger on releases for these currencies. Leave empty for every currency your key covers.',
			},
			{
				displayName: 'Indicators',
				name: 'indicators',
				type: 'string',
				default: '',
				placeholder: 'inflation, policy_rate, non_farm_payrolls',
				description:
					'Comma-separated indicator slugs to trigger on. Leave empty for every indicator.',
			},
			{
				displayName: 'Payload',
				name: 'payload',
				type: 'options',
				options: [
					{
						name: 'Compact',
						value: 'compact',
						description: 'Release event with the headline figure',
					},
					{
						name: 'Full',
						value: 'full',
						description: 'Release event with every field of the stored row',
					},
				],
				default: 'compact',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const staticData = this.getWorkflowStaticData('node');
		const currencies = this.getNodeParameter('currencies', []) as string[];
		const indicators = (this.getNodeParameter('indicators', '') as string)
			.split(',')
			.map((slug) => slug.trim())
			.filter(Boolean);
		const payload = this.getNodeParameter('payload', 'compact') as string;

		const qs: IDataObject = {
			currencies: currencies.length ? currencies.join(',') : 'all',
			indicators: indicators.join(','),
			payload,
			limit: 100,
		};

		const isManual = this.getMode() === 'manual';

		// On activation, start from now so the first run does not replay history.
		if (!isManual && !staticData.cursor) {
			const first = await fxmdRequest.call(this, '/v1/announcements/changes', {
				...qs,
				since: new Date().toISOString(),
				limit: 1,
			});
			staticData.cursor = (first.next_cursor as string) || new Date().toISOString();
			return null;
		}

		let since = isManual
			? new Date(Date.now() - MANUAL_LOOKBACK_MS).toISOString()
			: (staticData.cursor as string);
		const events: IDataObject[] = [];

		for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
			const response = await fxmdRequest.call(this, '/v1/announcements/changes', {
				...qs,
				since,
				limit: isManual ? 5 : 100,
			});
			const data = Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
			events.push(...data);
			if (response.next_cursor) since = response.next_cursor as string;
			if (isManual || response.has_more !== true || data.length === 0) break;
		}

		if (!isManual) staticData.cursor = since;

		if (events.length === 0) return null;
		return [this.helpers.returnJsonArray(events)];
	}
}
