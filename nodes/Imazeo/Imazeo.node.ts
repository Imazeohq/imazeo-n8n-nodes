import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	buildTransformBody,
	extensionForContentType,
	getBinaryBuffer,
	imazeoApiRequest,
	normalizeBaseUrl,
	pickHeader,
	prepareBinaryItem,
	projectPath,
	resolveProjectId,
	type ImazeoCredentials,
} from './GenericFunctions';

export class Imazeo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Imazeo',
		name: 'imazeo',
		icon: { light: 'file:imazeo.png', dark: 'file:imazeo.dark.png' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Image transforms, PDF tools, QR codes, and barcodes via the Imazeo API',
		defaults: {
			name: 'Imazeo',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'imazeoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Barcode', value: 'barcode' },
					{ name: 'Image', value: 'image' },
					{ name: 'PDF', value: 'pdf' },
					{ name: 'QR Code', value: 'qr' },
					{ name: 'Transform', value: 'transform' },
				],
				default: 'image',
			},

			// ── Image ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['image'] } },
				options: [
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete image',
						description: 'Permanently delete an owned original image',
					},
					{
						name: 'Download',
						value: 'download',
						action: 'Download image',
						description: 'Download original image bytes',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get image',
						description: 'Retrieve image metadata',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many images',
						description: 'List images in the project',
					},
					{
						name: 'Upload',
						value: 'upload',
						action: 'Upload image',
						description: 'Upload an original image from binary data',
					},
				],
				default: 'upload',
			},

			// ── Transform ──────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['transform'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create transform',
						description: 'Transform an owned image or public URL into binary output',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete transform',
						description: 'Delete a stored transformation record',
					},
					{
						name: 'Download',
						value: 'download',
						action: 'Download transform',
						description: 'Download stored derivative bytes',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get transform',
						description: 'Retrieve transformation metadata',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many transforms',
						description: 'List transformations in the project',
					},
				],
				default: 'create',
			},

			// ── QR ─────────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['qr'] } },
				options: [
					{
						name: 'Generate',
						value: 'generate',
						action: 'Generate QR code',
						description: 'Generate a QR code as PNG or SVG',
					},
				],
				default: 'generate',
			},

			// ── Barcode ────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['barcode'] } },
				options: [
					{
						name: 'Generate',
						value: 'generate',
						action: 'Generate barcode',
						description: 'Generate a barcode as PNG or SVG',
					},
				],
				default: 'generate',
			},

			// ── PDF ────────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['pdf'] } },
				options: [
					{
						name: 'Extract',
						value: 'extract',
						action: 'Extract PDF pages',
						description: 'Extract selected pages into a new PDF',
					},
					{
						name: 'Info',
						value: 'info',
						action: 'Get PDF info',
						description: 'Read PDF page count and page sizes',
					},
					{
						name: 'Merge',
						value: 'merge',
						action: 'Merge pd fs',
						description: 'Merge multiple PDF binaries in order',
					},
					{
						name: 'Render',
						value: 'render',
						action: 'Render PDF pages',
						description: 'Render PDF pages to image bytes or multi-page JSON',
					},
				],
				default: 'info',
			},

			// Shared binary / ID fields
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: ['image', 'pdf'],
						operation: ['upload', 'info', 'render', 'extract'],
					},
				},
				description: 'Name of the binary property that holds the input file',
			},
			{
				displayName: 'Image ID',
				name: 'imageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['image'],
						operation: ['get', 'download', 'delete'],
					},
				},
				description: 'Owned image ID (data._id from upload)',
			},
			{
				displayName: 'Transformation ID',
				name: 'transformationId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['transform'],
						operation: ['get', 'download', 'delete'],
					},
				},
				description: 'Stored transformation ID',
			},

			// Image list
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['image', 'transform'],
						operation: ['getAll'],
					},
				},
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 50,
				displayOptions: {
					show: {
						resource: ['image', 'transform'],
						operation: ['getAll'],
						returnAll: [false],
					},
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filename Prefix',
				name: 'q',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['image'], operation: ['getAll'] },
				},
				description: 'Optional filename / display-name prefix filter',
				placeholder: 'e.g. product',
			},

			// Transform create
			{
				displayName: 'Source',
				name: 'sourceMode',
				type: 'options',
				options: [
					{ name: 'Image ID', value: 'imageId' },
					{ name: 'Public URL', value: 'url' },
				],
				default: 'imageId',
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
				description: 'Exactly one of image ID or public URL is sent',
			},
			{
				displayName: 'Image ID',
				name: 'imageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['transform'],
						operation: ['create'],
						sourceMode: ['imageId'],
					},
				},
			},
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['transform'],
						operation: ['create'],
						sourceMode: ['url'],
					},
				},
				placeholder: 'e.g. https://example.com/image.png',
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{ name: 'Cache', value: 'CACHE' },
					{ name: 'Ephemeral', value: 'EPHEMERAL' },
					{ name: 'Persist', value: 'PERSIST' },
				],
				default: 'CACHE',
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
				description: 'CACHE retains temporarily, PERSIST stores longer, EPHEMERAL returns bytes only',
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 10000 },
				default: 0,
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
				description: 'Optional output width in pixels. Use 0 to omit.',
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 10000 },
				default: 0,
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
				description: 'Optional output height in pixels. Use 0 to omit.',
			},
			{
				displayName: 'Fit',
				name: 'fit',
				type: 'options',
				options: [
					{ name: 'Contain', value: 'contain' },
					{ name: 'Cover', value: 'cover' },
					{ name: 'Fill', value: 'fill' },
					{ name: 'Inside', value: 'inside' },
				],
				default: 'cover',
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'AVIF', value: 'avif' },
					{ name: 'GIF', value: 'gif' },
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'PNG', value: 'png' },
					{ name: 'WebP', value: 'webp' },
				],
				default: 'webp',
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
			},
			{
				displayName: 'Quality',
				name: 'quality',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 80,
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
			},
			{
				displayName: 'Options',
				name: 'transformOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['transform'], operation: ['create'] },
				},
				options: [
					{
						displayName: 'Background',
						name: 'background',
						type: 'string',
						default: '',
						placeholder: 'e.g. #ffffff',
					},
					{
						displayName: 'Blur',
						name: 'blur',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Brightness',
						name: 'brightness',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Flip Vertical',
						name: 'flip',
						type: 'boolean',
						default: false,
					},
					{
						displayName: 'Flop Horizontal',
						name: 'flop',
						type: 'boolean',
						default: false,
					},
					{
						displayName: 'Grayscale',
						name: 'grayscale',
						type: 'boolean',
						default: false,
					},
					{
						displayName: 'Hue',
						name: 'hue',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Max Output Bytes',
						name: 'maxOutputBytes',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
					},
					{
						displayName: 'Position',
						name: 'position',
						type: 'options',
						options: [
							{ name: 'Attention', value: 'attention' },
							{ name: 'Center', value: 'center' },
							{ name: 'Entropy', value: 'entropy' },
						],
						default: 'center',
					},
					{
						displayName: 'Rotate',
						name: 'rotate',
						type: 'options',
						options: [
							{ name: '0', value: 0 },
							{ name: '90', value: 90 },
							{ name: '180', value: 180 },
							{ name: '270', value: 270 },
						],
						default: 0,
					},
					{
						displayName: 'Saturation',
						name: 'saturation',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Sharpen',
						name: 'sharpen',
						type: 'number',
						default: 0,
					},
				],
			},
			{
				displayName: 'If-None-Match',
				name: 'ifNoneMatch',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['transform'], operation: ['download'] },
				},
				description: 'Optional ETag for conditional download (304 keeps prior bytes)',
			},

			// QR
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['qr', 'barcode'], operation: ['generate'] },
				},
				description: 'Text to encode. For barcodes, keep identifiers as strings to preserve leading zeros.',
				placeholder: 'e.g. https://imazeo.com',
			},
			{
				displayName: 'Barcode Type',
				name: 'barcodeType',
				type: 'options',
				required: true,
				options: [
					{ name: 'Code 128', value: 'code128' },
					{ name: 'Code 39', value: 'code39' },
					{ name: 'EAN-13', value: 'ean13' },
					{ name: 'EAN-8', value: 'ean8' },
					{ name: 'ITF-14', value: 'itf14' },
					{ name: 'UPC-A', value: 'upca' },
				],
				default: 'code128',
				displayOptions: {
					show: { resource: ['barcode'], operation: ['generate'] },
				},
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'SVG', value: 'svg' },
				],
				default: 'png',
				displayOptions: {
					show: { resource: ['qr', 'barcode'], operation: ['generate'] },
				},
			},
			{
				displayName: 'Options',
				name: 'codeOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['qr', 'barcode'], operation: ['generate'] },
				},
				options: [
					{
						displayName: 'Background',
						name: 'background',
						type: 'string',
						default: '#ffffff',
						placeholder: 'e.g. #ffffff',
					},
					{
						displayName: 'Barcode Height',
						name: 'height',
						type: 'number',
						default: 10,
						description: 'Barcode bar height in millimeters',
					},
					{
						displayName: 'Error Correction',
						name: 'errorCorrection',
						type: 'options',
						options: [
							{ name: 'L', value: 'L' },
							{ name: 'M', value: 'M' },
							{ name: 'Q', value: 'Q' },
							{ name: 'H', value: 'H' },
						],
						default: 'M',
						description: 'QR only',
					},
					{
						displayName: 'Foreground',
						name: 'foreground',
						type: 'string',
						default: '#000000',
						placeholder: 'e.g. #000000',
					},
					{
						displayName: 'Include Text',
						name: 'includeText',
						type: 'boolean',
						default: true,
						description: 'Whether to draw human-readable text under the barcode (barcode only)',
					},
					{
						displayName: 'Margin',
						name: 'margin',
						type: 'number',
						default: 2,
						description: 'QR quiet-zone margin in modules',
					},
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
					},
					{
						displayName: 'Scale',
						name: 'scale',
						type: 'number',
						default: 2,
						description: 'Barcode rendering scale',
					},
					{
						displayName: 'Size',
						name: 'size',
						type: 'number',
						default: 256,
						description: 'QR edge size in pixels (128–1024)',
					},
				],
			},

			// PDF options
			{
				displayName: 'Binary Properties',
				name: 'binaryPropertyNames',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: { resource: ['pdf'], operation: ['merge'] },
				},
				description:
					'Comma-separated binary property names to merge in order (e.g. data,data1)',
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'string',
				default: '1',
				displayOptions: {
					show: { resource: ['pdf'], operation: ['render', 'extract'] },
				},
				description: 'One-based page selection such as 1 or 1,2. Do not combine with range/all.',
				placeholder: 'e.g. 1,2',
			},
			{
				displayName: 'Render Format',
				name: 'renderFormat',
				type: 'options',
				options: [
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'PNG', value: 'png' },
					{ name: 'WebP', value: 'webp' },
				],
				default: 'png',
				displayOptions: {
					show: { resource: ['pdf'], operation: ['render'] },
				},
			},
			{
				displayName: 'Options',
				name: 'pdfOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['pdf'], operation: ['render', 'extract'] },
				},
				options: [
					{
						displayName: 'All Pages',
						name: 'all',
						type: 'boolean',
						default: false,
						description:
							'Whether to render every page (render only). Do not combine with pages/range.',
					},
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryPropertyName',
						type: 'string',
						default: 'data',
					},
					{
						displayName: 'Quality',
						name: 'quality',
						type: 'number',
						default: 80,
						description: 'Render quality for jpeg/webp',
					},
					{
						displayName: 'Range End',
						name: 'rangeEnd',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Range Start',
						name: 'rangeStart',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Scale',
						name: 'scale',
						type: 'number',
						default: 1,
						description: 'Render scale',
					},
				],
			},
			{
				displayName: 'Output Binary Property',
				name: 'outputBinaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						resource: ['image', 'transform', 'pdf'],
						operation: ['download', 'merge'],
					},
				},
				description: 'Binary property name used for file output where applicable',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = (await this.getCredentials('imazeoApi')) as ImazeoCredentials;
		const baseUrl = normalizeBaseUrl(credentials.baseUrl);
		const projectId = await resolveProjectId.call(this);

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'image') {
					await executeImage.call(this, {
						i,
						operation,
						baseUrl,
						projectId,
						returnData,
					});
				} else if (resource === 'transform') {
					await executeTransform.call(this, {
						i,
						operation,
						baseUrl,
						projectId,
						returnData,
					});
				} else if (resource === 'qr') {
					await executeQr.call(this, { i, baseUrl, projectId, returnData });
				} else if (resource === 'barcode') {
					await executeBarcode.call(this, { i, baseUrl, projectId, returnData });
				} else if (resource === 'pdf') {
					await executePdf.call(this, {
						i,
						operation,
						baseUrl,
						projectId,
						returnData,
					});
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeApiError || error instanceof NodeOperationError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
						itemIndex: i,
					});
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function executeImage(
	this: IExecuteFunctions,
	ctx: {
		i: number;
		operation: string;
		baseUrl: string;
		projectId: string;
		returnData: INodeExecutionData[];
	},
) {
	const { i, operation, baseUrl, projectId, returnData } = ctx;

	if (operation === 'upload') {
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
		const file = await getBinaryBuffer.call(this, i, binaryPropertyName);
		const form = new FormData();
		form.append(
			'file',
			new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
			file.fileName,
		);
		const response = await imazeoApiRequest.call(
			this,
			'POST',
			projectPath(baseUrl, projectId, 'images'),
			{
				body: form,
				headers: { 'X-Upload-Length': String(file.buffer.byteLength) },
				json: true,
				timeout: 60_000,
			},
		);
		const envelope = response.body as IDataObject;
		const data = (envelope.data as IDataObject) ?? {};
		returnData.push({
			json: data,
			pairedItem: { item: i },
		});
		return;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const q = (this.getNodeParameter('q', i, '') as string).trim();
		const limit = returnAll ? 100 : (this.getNodeParameter('limit', i) as number);
		let page = 1;
		let pages = 1;
		const collected: IDataObject[] = [];
		do {
			const qs: IDataObject = { page, limit };
			if (q) qs.q = q;
			const response = await imazeoApiRequest.call(
				this,
				'GET',
				projectPath(baseUrl, projectId, 'images'),
				{ qs, timeout: 60_000 },
			);
			const envelope = response.body as IDataObject;
			const items = (envelope.data as IDataObject[]) ?? [];
			collected.push(...items);
			const meta = (envelope.meta as IDataObject) ?? {};
			pages = Number(meta.pages ?? 1);
			page += 1;
		} while (returnAll && page <= pages);
		for (const item of collected) {
			returnData.push({ json: item, pairedItem: { item: i } });
		}
		return;
	}

	const imageId = this.getNodeParameter('imageId', i) as string;
	if (operation === 'get') {
		const response = await imazeoApiRequest.call(
			this,
			'GET',
			projectPath(baseUrl, projectId, 'images', imageId),
		);
		returnData.push({
			json: ((response.body as IDataObject).data as IDataObject) ?? {},
			pairedItem: { item: i },
		});
		return;
	}
	if (operation === 'delete') {
		await imazeoApiRequest.call(
			this,
			'DELETE',
			projectPath(baseUrl, projectId, 'images', imageId),
		);
		returnData.push({ json: { deleted: true, id: imageId }, pairedItem: { item: i } });
		return;
	}
	if (operation === 'download') {
		const outputBinaryPropertyName = this.getNodeParameter(
			'outputBinaryPropertyName',
			i,
			'data',
		) as string;
		const response = await imazeoApiRequest.call(
			this,
			'GET',
			projectPath(baseUrl, projectId, 'images', imageId, 'content'),
			{ encoding: 'arraybuffer', json: false, timeout: 60_000 },
		);
		const contentType =
			pickHeader(response.headers, 'content-type') ?? 'application/octet-stream';
		const fileName = `image-${imageId}.${extensionForContentType(contentType)}`;
		returnData.push(
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				fileName,
				contentType,
				{ imageId },
				outputBinaryPropertyName,
			),
		);
		return;
	}

	throw new NodeOperationError(this.getNode(), `Unknown image operation: ${operation}`, {
		itemIndex: i,
	});
}

async function executeTransform(
	this: IExecuteFunctions,
	ctx: {
		i: number;
		operation: string;
		baseUrl: string;
		projectId: string;
		returnData: INodeExecutionData[];
	},
) {
	const { i, operation, baseUrl, projectId, returnData } = ctx;

	if (operation === 'create') {
		const sourceMode = this.getNodeParameter('sourceMode', i) as 'imageId' | 'url';
		const options = this.getNodeParameter('transformOptions', i, {}) as IDataObject;
		const widthRaw = this.getNodeParameter('width', i, 0) as number;
		const heightRaw = this.getNodeParameter('height', i, 0) as number;
		const body = buildTransformBody({
			sourceMode,
			imageId: this.getNodeParameter('imageId', i, '') as string,
			url: this.getNodeParameter('imageUrl', i, '') as string,
			mode: this.getNodeParameter('mode', i) as string,
			width: widthRaw > 0 ? widthRaw : undefined,
			height: heightRaw > 0 ? heightRaw : undefined,
			fit: this.getNodeParameter('fit', i) as string,
			format: this.getNodeParameter('format', i) as string,
			quality: this.getNodeParameter('quality', i) as number,
			maxOutputBytes:
				typeof options.maxOutputBytes === 'number' && options.maxOutputBytes > 0
					? options.maxOutputBytes
					: undefined,
			rotate: options.rotate as number | undefined,
			flip: options.flip as boolean | undefined,
			flop: options.flop as boolean | undefined,
			grayscale: options.grayscale as boolean | undefined,
			blur: options.blur as number | undefined,
			sharpen: options.sharpen as number | undefined,
			brightness: options.brightness as number | undefined,
			saturation: options.saturation as number | undefined,
			hue: options.hue as number | undefined,
			background: options.background as string | undefined,
			position: options.position as string | undefined,
		});
		const outputBinaryPropertyName =
			(options.outputBinaryPropertyName as string) || 'data';
		const response = await imazeoApiRequest.call(
			this,
			'POST',
			projectPath(baseUrl, projectId, 'transforms'),
			{
				body,
				headers: { 'Content-Type': 'application/json' },
				encoding: 'arraybuffer',
				json: false,
				timeout: 60_000,
			},
		);
		const contentType = pickHeader(response.headers, 'content-type') ?? 'image/webp';
		const transformationId = pickHeader(response.headers, 'x-transformation-id');
		const cache = pickHeader(response.headers, 'x-cache');
		const ext = extensionForContentType(contentType);
		returnData.push(
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				`transform.${ext}`,
				contentType,
				{
					transformationId,
					cache,
					requestId: pickHeader(response.headers, 'x-request-id'),
				},
				outputBinaryPropertyName,
			),
		);
		return;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? 100 : (this.getNodeParameter('limit', i) as number);
		let page = 1;
		let pages = 1;
		const collected: IDataObject[] = [];
		do {
			const response = await imazeoApiRequest.call(
				this,
				'GET',
				projectPath(baseUrl, projectId, 'transforms'),
				{ qs: { page, limit }, timeout: 60_000 },
			);
			const envelope = response.body as IDataObject;
			collected.push(...(((envelope.data as IDataObject[]) ?? []) as IDataObject[]));
			pages = Number(((envelope.meta as IDataObject) ?? {}).pages ?? 1);
			page += 1;
		} while (returnAll && page <= pages);
		for (const item of collected) {
			returnData.push({ json: item, pairedItem: { item: i } });
		}
		return;
	}

	const transformationId = this.getNodeParameter('transformationId', i) as string;
	if (operation === 'get') {
		const response = await imazeoApiRequest.call(
			this,
			'GET',
			projectPath(baseUrl, projectId, 'transforms', transformationId),
		);
		returnData.push({
			json: ((response.body as IDataObject).data as IDataObject) ?? {},
			pairedItem: { item: i },
		});
		return;
	}
	if (operation === 'delete') {
		await imazeoApiRequest.call(
			this,
			'DELETE',
			projectPath(baseUrl, projectId, 'transforms', transformationId),
		);
		returnData.push({
			json: { deleted: true, id: transformationId },
			pairedItem: { item: i },
		});
		return;
	}
	if (operation === 'download') {
		const ifNoneMatch = (this.getNodeParameter('ifNoneMatch', i, '') as string).trim();
		const outputBinaryPropertyName = this.getNodeParameter(
			'outputBinaryPropertyName',
			i,
			'data',
		) as string;
		const headers: IDataObject = {};
		if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch;
		const response = await imazeoApiRequest.call(
			this,
			'GET',
			projectPath(baseUrl, projectId, 'transforms', transformationId, 'content'),
			{ headers, encoding: 'arraybuffer', json: false, timeout: 60_000 },
		);
		if (response.statusCode === 304) {
			returnData.push({
				json: { notModified: true, transformationId },
				pairedItem: { item: i },
			});
			return;
		}
		const contentType =
			pickHeader(response.headers, 'content-type') ?? 'application/octet-stream';
		returnData.push(
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				`transform-${transformationId}.${extensionForContentType(contentType)}`,
				contentType,
				{
					transformationId,
					etag: pickHeader(response.headers, 'etag'),
				},
				outputBinaryPropertyName,
			),
		);
		return;
	}

	throw new NodeOperationError(this.getNode(), `Unknown transform operation: ${operation}`, {
		itemIndex: i,
	});
}

async function executeQr(
	this: IExecuteFunctions,
	ctx: {
		i: number;
		baseUrl: string;
		projectId: string;
		returnData: INodeExecutionData[];
	},
) {
	const { i, baseUrl, projectId, returnData } = ctx;
	const options = this.getNodeParameter('codeOptions', i, {}) as IDataObject;
	const body: IDataObject = {
		content: this.getNodeParameter('content', i) as string,
		format: this.getNodeParameter('outputFormat', i) as string,
	};
	if (options.size !== undefined) body.size = options.size;
	if (options.margin !== undefined) body.margin = options.margin;
	if (options.errorCorrection) body.errorCorrection = options.errorCorrection;
	if (options.foreground) body.foreground = options.foreground;
	if (options.background) body.background = options.background;

	const response = await imazeoApiRequest.call(
		this,
		'POST',
		projectPath(baseUrl, projectId, 'tools', 'qr'),
		{
			body,
			headers: { 'Content-Type': 'application/json' },
			encoding: 'arraybuffer',
			json: false,
			timeout: 30_000,
		},
	);
	const contentType = pickHeader(response.headers, 'content-type') ?? 'image/png';
	const outputBinaryPropertyName = (options.outputBinaryPropertyName as string) || 'data';
	returnData.push(
		await prepareBinaryItem.call(
			this,
			i,
			response.body as ArrayBuffer,
			`qr.${extensionForContentType(contentType)}`,
			contentType,
			{ requestId: pickHeader(response.headers, 'x-request-id') },
			outputBinaryPropertyName,
		),
	);
}

async function executeBarcode(
	this: IExecuteFunctions,
	ctx: {
		i: number;
		baseUrl: string;
		projectId: string;
		returnData: INodeExecutionData[];
	},
) {
	const { i, baseUrl, projectId, returnData } = ctx;
	const options = this.getNodeParameter('codeOptions', i, {}) as IDataObject;
	const body: IDataObject = {
		type: this.getNodeParameter('barcodeType', i) as string,
		content: String(this.getNodeParameter('content', i)),
		format: this.getNodeParameter('outputFormat', i) as string,
	};
	if (options.scale !== undefined) body.scale = options.scale;
	if (options.height !== undefined) body.height = options.height;
	if (options.includeText !== undefined) body.includeText = options.includeText;
	if (options.foreground) body.foreground = options.foreground;
	if (options.background) body.background = options.background;

	const response = await imazeoApiRequest.call(
		this,
		'POST',
		projectPath(baseUrl, projectId, 'tools', 'barcode'),
		{
			body,
			headers: { 'Content-Type': 'application/json' },
			encoding: 'arraybuffer',
			json: false,
			timeout: 30_000,
		},
	);
	const contentType = pickHeader(response.headers, 'content-type') ?? 'image/png';
	const outputBinaryPropertyName = (options.outputBinaryPropertyName as string) || 'data';
	returnData.push(
		await prepareBinaryItem.call(
			this,
			i,
			response.body as ArrayBuffer,
			`barcode.${extensionForContentType(contentType)}`,
			contentType,
			{ requestId: pickHeader(response.headers, 'x-request-id') },
			outputBinaryPropertyName,
		),
	);
}

async function executePdf(
	this: IExecuteFunctions,
	ctx: {
		i: number;
		operation: string;
		baseUrl: string;
		projectId: string;
		returnData: INodeExecutionData[];
	},
) {
	const { i, operation, baseUrl, projectId, returnData } = ctx;
	const options = this.getNodeParameter('pdfOptions', i, {}) as IDataObject;

	if (operation === 'merge') {
		const names = (this.getNodeParameter('binaryPropertyNames', i) as string)
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean);
		if (names.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Provide at least one binary property', {
				itemIndex: i,
			});
		}
		const form = new FormData();
		for (const [index, name] of names.entries()) {
			const file = await getBinaryBuffer.call(this, i, name);
			form.append(
				'file',
				new Blob([new Uint8Array(file.buffer)], { type: 'application/pdf' }),
				file.fileName || `file-${index + 1}.pdf`,
			);
		}
		const response = await imazeoApiRequest.call(
			this,
			'POST',
			projectPath(baseUrl, projectId, 'tools', 'pdf', 'merge'),
			{ body: form, encoding: 'arraybuffer', json: false, timeout: 120_000 },
		);
		const outputBinaryPropertyName = this.getNodeParameter(
			'outputBinaryPropertyName',
			i,
			'data',
		) as string;
		returnData.push(
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				'merged.pdf',
				pickHeader(response.headers, 'content-type') ?? 'application/pdf',
				{},
				outputBinaryPropertyName,
			),
		);
		return;
	}

	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
	const file = await getBinaryBuffer.call(this, i, binaryPropertyName);
	const form = new FormData();
	form.append(
		'file',
		new Blob([new Uint8Array(file.buffer)], { type: 'application/pdf' }),
		file.fileName || 'document.pdf',
	);

	if (operation === 'info') {
		const response = await imazeoApiRequest.call(
			this,
			'POST',
			projectPath(baseUrl, projectId, 'tools', 'pdf', 'info'),
			{ body: form, json: true, timeout: 120_000 },
		);
		returnData.push({
			json: ((response.body as IDataObject).data as IDataObject) ?? {},
			pairedItem: { item: i },
		});
		return;
	}

	const qs: IDataObject = {};
	const pages = (this.getNodeParameter('pages', i, '') as string).trim();
	if (pages) qs.pages = pages;
	if (options.rangeStart) qs.rangeStart = options.rangeStart;
	if (options.rangeEnd) qs.rangeEnd = options.rangeEnd;

	if (operation === 'extract') {
		const response = await imazeoApiRequest.call(
			this,
			'POST',
			projectPath(baseUrl, projectId, 'tools', 'pdf', 'extract'),
			{ body: form, qs, encoding: 'arraybuffer', json: false, timeout: 120_000 },
		);
		const outputBinaryPropertyName =
			(options.outputBinaryPropertyName as string) || 'data';
		returnData.push(
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				'extracted.pdf',
				pickHeader(response.headers, 'content-type') ?? 'application/pdf',
				{},
				outputBinaryPropertyName,
			),
		);
		return;
	}

	if (operation === 'render') {
		qs.format = this.getNodeParameter('renderFormat', i) as string;
		if (options.all === true) qs.all = true;
		if (options.scale !== undefined) qs.scale = options.scale;
		if (options.quality !== undefined) qs.quality = options.quality;
		const response = await imazeoApiRequest.call(
			this,
			'POST',
			projectPath(baseUrl, projectId, 'tools', 'pdf', 'render'),
			{ body: form, qs, encoding: 'arraybuffer', json: false, timeout: 120_000 },
		);
		const contentType = pickHeader(response.headers, 'content-type') ?? '';
		const outputBinaryPropertyName =
			(options.outputBinaryPropertyName as string) || 'data';

		// Multi-page renders may return JSON with base64 pages.
		if (contentType.includes('application/json')) {
			const text = Buffer.from(response.body as ArrayBuffer).toString('utf8');
			const envelope = JSON.parse(text) as IDataObject;
			const pagesPayload =
				((envelope.data as IDataObject)?.pages as IDataObject[]) ??
				(envelope.pages as IDataObject[]) ??
				[];
			for (const page of pagesPayload) {
				const pageNumber = Number(page.pageNumber ?? 0);
				const pageType = String(page.contentType ?? 'image/png');
				const bytes = Buffer.from(String(page.data ?? ''), 'base64');
				returnData.push(
					await prepareBinaryItem.call(
						this,
						i,
						bytes,
						`page-${pageNumber}.${extensionForContentType(pageType)}`,
						pageType,
						{
							pageNumber,
							width: page.width,
							height: page.height,
							requestId: ((envelope.meta as IDataObject) ?? {}).requestId,
						},
						outputBinaryPropertyName,
					),
				);
			}
			return;
		}

		returnData.push(
			await prepareBinaryItem.call(
				this,
				i,
				response.body as ArrayBuffer,
				`page.${extensionForContentType(contentType || 'image/png')}`,
				contentType || 'image/png',
				{ requestId: pickHeader(response.headers, 'x-request-id') },
				outputBinaryPropertyName,
			),
		);
		return;
	}

	throw new NodeOperationError(this.getNode(), `Unknown PDF operation: ${operation}`, {
		itemIndex: i,
	});
}
