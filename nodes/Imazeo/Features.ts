import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	extensionForContentType,
	getBinaryBuffer,
	imazeoApiRequest,
	pickHeader,
	prepareBinaryItem,
	projectPath,
} from './GenericFunctions';

const operations: Record<string, Array<[string, string, string]>> = {
	conversion: [
		['Cancel', 'cancel', 'Cancel a conversion'],
		['Capabilities', 'capabilities', 'Get conversion capabilities'],
		['Create', 'create', 'Create a conversion'],
		['Download', 'download', 'Download a conversion result'],
		['Get', 'get', 'Get a conversion'],
		['Get Many', 'list', 'List conversions'],
		['Lookup', 'lookup', 'Find a conversion by idempotency key'],
		['Save', 'save', 'Save a conversion result'],
	],
	dynamicCode: [
		['Analytics', 'analytics', 'Get QR scan analytics'],
		['Capabilities', 'capabilities', 'Get dynamic QR capabilities'],
		['Create', 'create', 'Create a dynamic QR link'],
		['Export Analytics', 'export', 'Export QR scans as CSV'],
		['Get', 'get', 'Get a dynamic QR link'],
		['Get Many', 'list', 'List dynamic QR links'],
		['Update', 'update', 'Update a dynamic QR link'],
	],
	artifact: [
		['Delete', 'delete', 'Delete a saved artifact'],
		['Download', 'download', 'Download a saved artifact'],
		['Get', 'get', 'Get a saved artifact'],
		['Get Many', 'list', 'List saved artifacts'],
		['Save', 'save', 'Save binary media as an artifact'],
	],
	output: [
		['Get Many', 'list', 'List project outputs'],
		['Summary', 'summary', 'Get project output counts'],
	],
	credit: [['Quote', 'quote', 'Get a processing credit quote']],
	processing: [
		['Get', 'get', 'Get operation status'],
		['Lookup', 'lookup', 'Find an operation by idempotency key'],
		['Result', 'result', 'Recover an operation result'],
	],
};

export const featureProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['conversion'] } },
		options: [
			{ name: 'Cancel', value: 'cancel', action: 'Cancel a conversion' },
			{ name: 'Capabilities', value: 'capabilities', action: 'Get conversion capabilities' },
			{ name: 'Create', value: 'create', action: 'Create a conversion' },
			{ name: 'Download', value: 'download', action: 'Download a conversion result' },
			{ name: 'Get', value: 'get', action: 'Get a conversion' },
			{ name: 'Get Many', value: 'list', action: 'List conversions' },
			{ name: 'Lookup', value: 'lookup', action: 'Find a conversion by idempotency key' },
			{ name: 'Save', value: 'save', action: 'Save a conversion result' },
		],
		default: 'cancel',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['dynamicCode'] } },
		options: [
			{ name: 'Analytics', value: 'analytics', action: 'Get QR scan analytics' },
			{ name: 'Capabilities', value: 'capabilities', action: 'Get dynamic QR capabilities' },
			{ name: 'Create', value: 'create', action: 'Create a dynamic QR link' },
			{ name: 'Export Analytics', value: 'export', action: 'Export QR scans as CSV' },
			{ name: 'Get', value: 'get', action: 'Get a dynamic QR link' },
			{ name: 'Get Many', value: 'list', action: 'List dynamic QR links' },
			{ name: 'Update', value: 'update', action: 'Update a dynamic QR link' },
		],
		default: 'analytics',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['artifact'] } },
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a saved artifact' },
			{ name: 'Download', value: 'download', action: 'Download a saved artifact' },
			{ name: 'Get', value: 'get', action: 'Get a saved artifact' },
			{ name: 'Get Many', value: 'list', action: 'List saved artifacts' },
			{ name: 'Save', value: 'save', action: 'Save binary media as an artifact' },
		],
		default: 'delete',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['output'] } },
		options: [
			{ name: 'Get Many', value: 'list', action: 'List project outputs' },
			{ name: 'Summary', value: 'summary', action: 'Get project output counts' },
		],
		default: 'list',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['credit'] } },
		options: [{ name: 'Quote', value: 'quote', action: 'Get a processing credit quote' }],
		default: 'quote',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['processing'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get operation status' },
			{ name: 'Lookup', value: 'lookup', action: 'Find an operation by idempotency key' },
			{ name: 'Result', value: 'result', action: 'Recover an operation result' },
		],
		default: 'get',
	},

	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['conversion', 'dynamicCode', 'processing'],
				operation: [
					'get',
					'update',
					'cancel',
					'download',
					'delete',
					'analytics',
					'export',
					'result',
					'save',
				],
			},
		},
		description: 'ID returned by the corresponding create or list operation',
	},
    {
        displayName: 'Record ID', name: 'recordId', type: 'string', default: '', required: true,
        displayOptions: { show: { resource: ['artifact'], operation: ['get', 'download', 'delete'] } },
        description: 'ID returned by artifact save or list',
    },
	{
		displayName: 'Engine',
		name: 'conversionEngine',
		type: 'options',
		default: 'docx',
		displayOptions: { show: { resource: ['conversion'], operation: ['create', 'list'] } },
		options: [
			{ name: 'DOCX', value: 'docx' },
			{ name: 'PPTX', value: 'pptx' },
			{ name: 'Website', value: 'website' },
			{ name: 'XLSX', value: 'xlsx' },
		],
	},
	{
		displayName: 'Website URL',
		name: 'websiteUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['conversion'], operation: ['create'], conversionEngine: ['website'] },
		},
		description: 'Public HTTP(S) page to capture',
	},
	{
		displayName: 'Input Binary Property',
		name: 'featureBinaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: {
			show: { resource: ['conversion'], operation: ['create'] },
			hide: { conversionEngine: ['website'] },
		},
		description: 'Binary property containing the DOCX, XLSX, or PPTX document',
	},
	{
		displayName: 'Input Binary Property',
		name: 'featureBinaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { resource: ['artifact'], operation: ['save'] } },
		description: 'Binary property containing the media to save',
	},
	{
		displayName: 'Request Body',
		name: 'featureBody',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				resource: ['dynamicCode', 'artifact', 'credit', 'processing'],
				operation: ['create', 'update', 'save', 'quote', 'lookup'],
			},
		},
		description:
			'API fields: name/destination for links; expectedRevision for edits; kind/units for quotes; kind/key for operation lookup; kind/displayName/contentType for artifacts',
	},
	{
		displayName: 'Query Options',
		name: 'featureQuery',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['conversion', 'dynamicCode', 'artifact', 'output'],
				operation: ['create', 'list', 'analytics', 'export'],
			},
		},
		description:
			'Conversion rendering options, page/limit and resource filters, or days/device/browser/country/bot scan filters',
	},
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['qr', 'barcode', 'pdf', 'transform', 'conversion', 'dynamicCode'],
				operation: ['generate', 'info', 'render', 'merge', 'extract', 'create', 'update', 'lookup'],
			},
		},
		description:
			'UUID v4 required for conversion creation and lookup, and dynamic QR creation and edits. Reuse only for the same request.',
	},
	{
		displayName: 'Quote ID',
		name: 'quoteId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['qr', 'barcode', 'pdf', 'transform', 'conversion'],
				operation: ['generate', 'info', 'render', 'merge', 'extract', 'create'],
			},
		},
		description: 'Owned, unexpired credit quote ID. Required to create a conversion.',
	},
	{
		displayName: 'Transparent Background',
		name: 'transparent',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['qr', 'barcode'] } },
		description: 'Whether to export without a background',
	},
	{
		displayName: 'Design',
		name: 'codeDesign',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['qr', 'barcode'] } },
		description:
			'Optional design object with schemaVersion, template and templateVersion; QR logos use an owned logoImageId',
	},
];

export function parseObject(value: unknown): IDataObject {
	const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
		throw new Error('Expected a JSON object');
	return parsed as IDataObject;
}

export function requestHeaders(this: IExecuteFunctions, i: number): IDataObject {
	const headers: IDataObject = {};
	const key = this.getNodeParameter('idempotencyKey', i, '') as string;
	const quote = this.getNodeParameter('quoteId', i, '') as string;
	if (key) headers['Idempotency-Key'] = key;
	if (quote) headers['X-Quote-ID'] = quote;
	return headers;
}

export async function executeFeature(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
	baseUrl: string,
	projectId: string,
): Promise<INodeExecutionData[]> {
	if (!operations[resource]?.some(([, value]) => value === operation))
		throw new NodeOperationError(this.getNode(), 'Unknown Imazeo operation', { itemIndex: i });
	const id = this.getNodeParameter('recordId', i, '') as string;
	const body = parseObject(this.getNodeParameter('featureBody', i, '{}'));
	const qs = parseObject(this.getNodeParameter('featureQuery', i, '{}'));
	const headers = requestHeaders.call(this, i);
	let method: IHttpRequestMethods = 'GET';
	let parts: string[];
	let payload: IDataObject | FormData | undefined;
	let binary = false;
	if (resource === 'conversion') {
		parts = ['conversions'];
		if (operation === 'create') {
			method = 'POST';
			const engine = this.getNodeParameter('conversionEngine', i) as string;
			if (!headers['Idempotency-Key'] || !headers['X-Quote-ID'])
				throw new NodeOperationError(
					this.getNode(),
					'Conversion creation requires an idempotency key and quote ID',
					{ itemIndex: i },
				);
			if (engine !== 'docx') parts.push(engine);
			if (engine === 'website') payload = { url: this.getNodeParameter('websiteUrl', i) as string };
			else payload = await fileForm.call(this, i, headers);
		} else if (operation === 'list')
			qs.engine = this.getNodeParameter('conversionEngine', i) as string;
		else if (operation === 'lookup') {
			parts.push('lookup');
			qs.key = this.getNodeParameter('idempotencyKey', i) as string;
		} else if (operation === 'capabilities') parts.push('capabilities');
		else {
			parts.push(id);
			if (operation !== 'get') parts.push(operation);
			if (operation === 'cancel' || operation === 'save') method = 'POST';
			binary = operation === 'download';
		}
	} else if (resource === 'dynamicCode') {
		parts = ['dynamic-codes'];
		if (operation === 'create' || operation === 'update') {
			if (!headers['Idempotency-Key'])
				throw new NodeOperationError(
					this.getNode(),
					'Dynamic QR changes require an idempotency key',
					{ itemIndex: i },
				);
			method = operation === 'create' ? 'POST' : 'PATCH';
			payload = body;
			if (operation === 'update') parts.push(id);
		} else if (operation === 'capabilities') parts.push('capabilities');
		else if (operation !== 'list') {
			parts.push(id);
			if (operation === 'analytics' || operation === 'export') parts.push('analytics');
			if (operation === 'export') {
				parts.push('export');
				binary = true;
			}
		}
	} else if (resource === 'artifact') {
		parts = ['tools', 'artifacts'];
		if (operation === 'save') {
			method = 'POST';
			const form = await fileForm.call(this, i, headers);
			for (const [key, value] of Object.entries(body))
				if (value !== undefined && value !== null)
					form.append(key, key === 'requestSnapshot' ? JSON.stringify(value) : String(value));
			payload = form;
		} else if (operation !== 'list') {
			parts.push(id);
			if (operation === 'download') {
				parts.push('content');
				binary = true;
			}
			if (operation === 'delete') method = 'DELETE';
		}
	} else if (resource === 'output') {
		parts = operation === 'summary' ? ['outputs', 'summary'] : ['outputs'];
	} else if (resource === 'credit') {
		parts = ['credits', 'quote'];
		method = 'POST';
		payload = body;
	} else {
		parts = ['operations'];
		if (operation === 'lookup') {
			parts.push('lookup');
			method = 'POST';
			payload = body;
		} else {
			parts.push(id);
			if (operation === 'result') {
				parts.push('result');
				binary = true;
			}
		}
	}
	if (payload && !(payload instanceof FormData)) headers['Content-Type'] = 'application/json';
	const response = await imazeoApiRequest.call(
		this,
		method,
		projectPath(baseUrl, projectId, ...parts),
		{
			body: payload,
			qs,
			headers,
			encoding: binary ? 'arraybuffer' : undefined,
			json: !binary,
			timeout: 60_000,
		},
	);
	const type = pickHeader(response.headers, 'content-type') ?? 'application/octet-stream';
	if (binary && !type.includes('application/json'))
		return [
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				operation === 'export' ? 'qr-scans.csv' : `output.${extensionForContentType(type)}`,
				type,
				{ requestId: pickHeader(response.headers, 'x-request-id') },
			),
		];
	const envelope = (
		binary ? JSON.parse(Buffer.from(response.body as ArrayBuffer).toString('utf8')) : response.body
	) as IDataObject;
	return [{ json: { data: envelope.data, meta: envelope.meta }, pairedItem: { item: i } }];
}

async function fileForm(
	this: IExecuteFunctions,
	i: number,
	headers: IDataObject,
): Promise<FormData> {
	const file = await getBinaryBuffer.call(
		this,
		i,
		this.getNodeParameter('featureBinaryProperty', i, 'data') as string,
	);
	const form = new FormData();
	form.append(
		'file',
		new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
		file.fileName,
	);
	headers['X-Upload-Length'] = file.buffer.length;
	return form;
}
