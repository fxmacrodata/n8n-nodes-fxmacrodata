import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

const CURRENCY_NAMES: Array<[string, string]> = [
	['AUD', 'Australian Dollar'],
	['BRL', 'Brazilian Real'],
	['CAD', 'Canadian Dollar'],
	['CHF', 'Swiss Franc'],
	['CNH', 'Chinese Yuan (Offshore)'],
	['CNY', 'Chinese Yuan'],
	['DKK', 'Danish Krone'],
	['EUR', 'Euro'],
	['GBP', 'British Pound'],
	['HUF', 'Hungarian Forint'],
	['ILS', 'Israeli Shekel'],
	['JPY', 'Japanese Yen'],
	['KRW', 'South Korean Won'],
	['MYR', 'Malaysian Ringgit'],
	['NGN', 'Nigerian Naira'],
	['NOK', 'Norwegian Krone'],
	['NZD', 'New Zealand Dollar'],
	['PEN', 'Peruvian Sol'],
	['SEK', 'Swedish Krona'],
	['THB', 'Thai Baht'],
	['TWD', 'New Taiwan Dollar'],
	['USD', 'US Dollar'],
];

export const CURRENCIES: INodePropertyOptions[] = CURRENCY_NAMES.map(([code, name]) => ({
	name: `${code} - ${name}`,
	value: code,
}));

const COT_CODES = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'];

export const COT_CURRENCIES: INodePropertyOptions[] = [
	...CURRENCIES.filter((option) => COT_CODES.includes(option.value as string)),
	{ name: 'XAU - Gold', value: 'XAU' },
];

export const COMMODITIES: INodePropertyOptions[] = [
	{ name: 'Brent Crude Oil', value: 'oil_brent' },
	{ name: 'Crude Oil Inventories (EIA)', value: 'crude_oil_inventories' },
	{ name: 'Gold', value: 'gold' },
	{ name: 'Natural Gas', value: 'natural_gas' },
	{ name: 'Natural Gas Storage (EIA)', value: 'natural_gas_storage' },
	{ name: 'Platinum', value: 'platinum' },
	{ name: 'Silver', value: 'silver' },
	{ name: 'WTI Crude Oil', value: 'oil_wti' },
];

export const COT_REPORTS: INodePropertyOptions[] = [
	{ name: 'Disaggregated (Futures Only)', value: 'disaggregated_futures' },
	{ name: 'Legacy (Futures and Options)', value: 'legacy_combined' },
	{ name: 'Legacy (Futures Only)', value: 'legacy_futures' },
	{ name: 'Traders in Financial Futures (Futures and Options)', value: 'tff_combined' },
	{ name: 'Traders in Financial Futures (Futures Only)', value: 'tff_futures' },
];

const show = (resource: string, operation: string[]) => ({
	show: { resource: [resource], operation },
});

const currencyField = (
	resource: string,
	operation: string[],
	options: INodePropertyOptions[] = CURRENCIES,
	defaultValue = 'USD',
): INodeProperties => ({
	displayName: 'Currency',
	name: 'currency',
	type: 'options',
	options,
	default: defaultValue,
	required: true,
	displayOptions: show(resource, operation),
	description: 'Three-letter currency code. USD is free without an API key; other currencies need one.',
});

const dateFields = (resource: string, operation: string[]): INodeProperties[] => [
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		default: '',
		displayOptions: show(resource, operation),
		description: 'Earliest date to return. Leave empty for the API default window.',
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		default: '',
		displayOptions: show(resource, operation),
		description: 'Latest date to return. Leave empty for the most recent data.',
	},
];

const paginationFields = (
	resource: string,
	operation: string[],
	maxPage: number,
): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: show(resource, operation),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: {
			show: { resource: [resource], operation, returnAll: [false] },
		},
		description: `Max number of results to return. Requests are paged ${maxPage} rows at a time.`,
	},
];

const outputField = (resource: string, operation: string[]): INodeProperties => ({
	displayName: 'Output',
	name: 'output',
	type: 'options',
	options: [
		{
			name: 'One Item per Row',
			value: 'rows',
			description: 'Each data row becomes its own n8n item',
		},
		{
			name: 'Full Response',
			value: 'response',
			description:
				'Return the API response as one item, including metadata such as source and provenance',
		},
	],
	default: 'rows',
	displayOptions: show(resource, operation),
});

export const resourceField: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Announcement', value: 'announcement' },
		{ name: 'COT Positioning', value: 'cot' },
		{ name: 'Commodity', value: 'commodity' },
		{ name: 'Data Catalogue', value: 'catalogue' },
		{ name: 'Economic Calendar', value: 'calendar' },
		{ name: 'FX Rate', value: 'forex' },
		{ name: 'Market Session', value: 'marketSession' },
		{ name: 'Press Release', value: 'pressRelease' },
		{ name: 'Risk Sentiment', value: 'riskSentiment' },
	],
	default: 'announcement',
};

export const operationFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['announcement'] } },
		options: [
			{
				name: 'Get History',
				value: 'getHistory',
				description: 'Get the release history of one indicator',
				action: 'Get indicator release history',
			},
			{
				name: 'Get Latest',
				value: 'getLatest',
				description: 'Get the latest release of every indicator for a currency',
				action: 'Get latest releases for a currency',
			},
		],
		default: 'getHistory',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['calendar'] } },
		options: [
			{
				name: 'Get Events',
				value: 'getEvents',
				description: 'Get scheduled and recent release dates for a currency',
				action: 'Get economic calendar events',
			},
		],
		default: 'getEvents',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['forex'] } },
		options: [
			{
				name: 'Get Rates',
				value: 'getRates',
				description: 'Get daily FX rates for a currency pair',
				action: 'Get FX rates',
			},
		],
		default: 'getRates',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['cot'] } },
		options: [
			{
				name: 'Get Reports',
				value: 'getReports',
				description: 'Get weekly CFTC Commitments of Traders positioning',
				action: 'Get COT reports',
			},
		],
		default: 'getReports',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['commodity'] } },
		options: [
			{
				name: 'Get History',
				value: 'getHistory',
				description: 'Get the price or inventory history of one commodity',
				action: 'Get commodity history',
			},
			{
				name: 'Get Latest',
				value: 'getLatest',
				description: 'Get the latest value of every commodity',
				action: 'Get latest commodity values',
			},
		],
		default: 'getHistory',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['catalogue'] } },
		options: [
			{
				name: 'Get Indicators',
				value: 'getIndicators',
				description: 'List the indicators published for a currency, with units and sources',
				action: 'List indicators for a currency',
			},
		],
		default: 'getIndicators',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['marketSession'] } },
		options: [
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get which FX trading sessions are open and how they overlap',
				action: 'Get FX market session status',
			},
		],
		default: 'getStatus',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['pressRelease'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Get official central-bank and agency press releases',
				action: 'Get press releases',
			},
		],
		default: 'getMany',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['riskSentiment'] } },
		options: [
			{
				name: 'Get History',
				value: 'getHistory',
				description: 'Get the daily global risk-sentiment composite',
				action: 'Get risk sentiment history',
			},
		],
		default: 'getHistory',
	},
];

export const parameterFields: INodeProperties[] = [
	// Announcement
	currencyField('announcement', ['getHistory', 'getLatest']),
	{
		displayName: 'Indicator Name or ID',
		name: 'indicator',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getIndicators', loadOptionsDependsOn: ['currency'] },
		default: '',
		required: true,
		displayOptions: show('announcement', ['getHistory']),
		description:
			'Indicator to fetch, such as inflation, policy_rate or non_farm_payrolls. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	...dateFields('announcement', ['getHistory']),
	...paginationFields('announcement', ['getHistory'], 100),
	outputField('announcement', ['getHistory', 'getLatest']),

	// Calendar
	currencyField('calendar', ['getEvents']),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('calendar', ['getEvents']),
		options: [
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'Latest event date to return',
			},
			{
				displayName: 'Indicator',
				name: 'indicator',
				type: 'string',
				default: '',
				placeholder: 'inflation',
				description: 'Only return events for this indicator slug',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'Earliest event date to return',
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/London',
				description:
					'IANA timezone for an additional converted timestamp on each event. Times are always also given in UTC.',
			},
		],
	},
	outputField('calendar', ['getEvents']),

	// FX rates
	{
		displayName: 'Base Currency',
		name: 'base',
		type: 'options',
		options: CURRENCIES,
		default: 'EUR',
		required: true,
		displayOptions: show('forex', ['getRates']),
	},
	{
		displayName: 'Quote Currency',
		name: 'quote',
		type: 'options',
		options: CURRENCIES,
		default: 'USD',
		required: true,
		displayOptions: show('forex', ['getRates']),
	},
	...dateFields('forex', ['getRates']),
	...paginationFields('forex', ['getRates'], 100),
	outputField('forex', ['getRates']),

	// COT
	currencyField('cot', ['getReports'], COT_CURRENCIES, 'EUR'),
	{
		displayName: 'Report',
		name: 'report',
		type: 'options',
		options: COT_REPORTS,
		default: 'legacy_futures',
		displayOptions: show('cot', ['getReports']),
		description: 'CFTC report family',
	},
	...dateFields('cot', ['getReports']),
	...paginationFields('cot', ['getReports'], 100),
	outputField('cot', ['getReports']),

	// Commodities
	{
		displayName: 'Commodity',
		name: 'commodity',
		type: 'options',
		options: COMMODITIES,
		default: 'gold',
		required: true,
		displayOptions: show('commodity', ['getHistory']),
	},
	...dateFields('commodity', ['getHistory']),
	...paginationFields('commodity', ['getHistory'], 100),
	outputField('commodity', ['getHistory', 'getLatest']),

	// Catalogue
	currencyField('catalogue', ['getIndicators']),
	outputField('catalogue', ['getIndicators']),

	// Press releases
	currencyField('pressRelease', ['getMany']),
	...paginationFields('pressRelease', ['getMany'], 50),
	outputField('pressRelease', ['getMany']),

	// Risk sentiment
	...dateFields('riskSentiment', ['getHistory']),
	...paginationFields('riskSentiment', ['getHistory'], 100),
	outputField('riskSentiment', ['getHistory']),
];
