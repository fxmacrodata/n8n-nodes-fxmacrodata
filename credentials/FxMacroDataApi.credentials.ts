import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FxMacroDataApi implements ICredentialType {
	name = 'fxMacroDataApi';

	displayName = 'FXMacroData API';

	icon: Icon = { light: 'file:../icons/fxmacrodata.svg', dark: 'file:../icons/fxmacrodata.dark.svg' };

	documentationUrl =
		'https://github.com/fxmacrodata/n8n-nodes-fxmacrodata?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your FXMacroData API key, shown on your account page at fxmacrodata.com after subscribing',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// FX rates require a paid key, so this request fails for a missing or invalid key.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.fxmacrodata.com',
			url: '/v1/forex/EUR/USD',
			method: 'GET',
			qs: { limit: 1 },
		},
	};
}
