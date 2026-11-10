import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class ImazeoApi implements ICredentialType {
	name = 'imazeoApi';

	displayName = 'Imazeo API';

	documentationUrl = 'https://imazeo.com/docs/authentication/';

	icon: Icon = { light: 'file:imazeo.png', dark: 'file:imazeo.dark.png' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Project API key from the Imazeo Customer portal. Sent as X-API-Key. Server-side only.',
		},
		{
			displayName: 'API Origin',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.imazeo.com',
			required: true,
			description: 'API origin only (no /v1 suffix). Default production origin is https://api.imazeo.com.',
			placeholder: 'e.g. https://api.imazeo.com',
		},
		{
			displayName: 'Project ID',
			name: 'projectId',
			type: 'string',
			default: '',
			description:
				'Optional project UUID. Leave empty to resolve automatically via GET /v1/api-key/context.',
			placeholder: 'e.g. 00000000-0000-4000-8000-000000000001',
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

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/api-key/context',
		},
	};
}
