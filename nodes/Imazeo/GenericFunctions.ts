import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export type ImazeoCredentials = {
	apiKey: string;
	baseUrl: string;
	projectId?: string;
};

/** Normalize API origin: strip trailing slash and accidental /v1 suffix. */
export function normalizeBaseUrl(raw: string): string {
	let parsed: URL | undefined;
	try {
		parsed = new URL(raw.trim());
	} catch {
		parsed = undefined;
	}
	if (!parsed) {
		throw new Error(`Invalid API origin: ${raw}`);
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('API origin must use http or https');
	}
	if (parsed.username || parsed.password) {
		throw new Error('API origin must not include credentials');
	}
	let path = parsed.pathname.replace(/\/+$/, '');
	if (path === '/v1') path = '';
	parsed.pathname = path || '/';
	parsed.search = '';
	parsed.hash = '';
	const originAndPath = path && path !== '/' ? `${parsed.origin}${path}` : parsed.origin;
	return originAndPath.replace(/\/+$/, '');
}

export function projectPath(baseUrl: string, projectId: string, ...segments: string[]): string {
	const encoded = ['projects', projectId, ...segments]
		.map((part) => encodeURIComponent(part).replace(/%2F/g, '/'))
		.join('/');
	return `${normalizeBaseUrl(baseUrl)}/v1/${encoded}`;
}

export function contextPath(baseUrl: string): string {
	return `${normalizeBaseUrl(baseUrl)}/v1/api-key/context`;
}

export function extensionForContentType(contentType: string): string {
	const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	const map: Record<string, string> = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/webp': 'webp',
		'image/avif': 'avif',
		'image/gif': 'gif',
		'image/svg+xml': 'svg',
		'application/pdf': 'pdf',
		'application/octet-stream': 'bin',
	};
	return map[type] ?? 'bin';
}

export function pickHeader(
	headers: IDataObject | undefined,
	name: string,
): string | undefined {
	if (!headers) return undefined;
	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === target && value !== undefined && value !== null) {
			return String(value);
		}
	}
	return undefined;
}

export function buildTransformBody(params: {
	sourceMode: 'imageId' | 'url';
	imageId?: string;
	url?: string;
	mode?: string;
	maxOutputBytes?: number;
	width?: number;
	height?: number;
	fit?: string;
	format?: string;
	quality?: number;
	rotate?: number;
	flip?: boolean;
	flop?: boolean;
	grayscale?: boolean;
	blur?: number;
	sharpen?: number;
	brightness?: number;
	saturation?: number;
	hue?: number;
	background?: string;
	position?: string;
}): IDataObject {
	if (params.sourceMode === 'imageId') {
		if (!params.imageId) throw new Error('Image ID is required');
	} else if (!params.url) {
		throw new Error('Image URL is required');
	}

	const transform: IDataObject = {};
	const assign = (key: string, value: unknown) => {
		if (value === undefined || value === null || value === '') return;
		transform[key] = value;
	};

	assign('width', params.width);
	assign('height', params.height);
	assign('fit', params.fit);
	assign('format', params.format);
	assign('quality', params.quality);
	assign('rotate', params.rotate);
	if (params.flip === true) transform.flip = true;
	if (params.flop === true) transform.flop = true;
	if (params.grayscale === true) transform.grayscale = true;
	assign('blur', params.blur);
	assign('sharpen', params.sharpen);
	assign('brightness', params.brightness);
	assign('saturation', params.saturation);
	assign('hue', params.hue);
	assign('background', params.background);
	assign('position', params.position);

	const body: IDataObject =
		params.sourceMode === 'imageId'
			? { imageId: params.imageId }
			: { url: params.url };

	if (params.mode) body.mode = params.mode;
	if (params.maxOutputBytes) body.maxOutputBytes = params.maxOutputBytes;
	if (Object.keys(transform).length > 0) body.transform = transform;
	return body;
}

export async function imazeoApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	url: string,
	options: {
		body?: IDataObject | FormData | Buffer | string;
		qs?: IDataObject;
		headers?: IDataObject;
		encoding?: 'arraybuffer' | undefined;
		json?: boolean;
		timeout?: number;
	} = {},
): Promise<{
	body: unknown;
	headers: IDataObject;
	statusCode: number;
}> {
	const headers: IDataObject = {
		Accept: options.encoding === 'arraybuffer' ? '*/*' : 'application/json',
		'User-Agent': 'Imazeo-n8n/0.1.0',
		...(options.headers ?? {}),
	};

	const requestOptions: IHttpRequestOptions = {
		method,
		url,
		qs: options.qs,
		headers,
		body: options.body,
		json: options.json ?? options.encoding !== 'arraybuffer',
		encoding: options.encoding,
		returnFullResponse: true,
		timeout: options.timeout,
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'imazeoApi',
			requestOptions,
		);
		const full = response as { body: unknown; headers?: IDataObject; statusCode?: number };
		return {
			body: full.body,
			headers: (full.headers ?? {}) as IDataObject,
			statusCode: full.statusCode ?? 200,
		};
	} catch (error) {
		throw mapImazeoError.call(this, error);
	}
}

export async function resolveProjectId(
	this: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<string> {
	const credentials = (await this.getCredentials('imazeoApi')) as ImazeoCredentials;
	const configured = (credentials.projectId ?? '').trim();
	if (configured) return configured;

	const response = await imazeoApiRequest.call(this, 'GET', contextPath(credentials.baseUrl), {
		timeout: 30_000,
	});
	const data = (response.body as IDataObject)?.data as IDataObject | undefined;
	const projectId = typeof data?.projectId === 'string' ? data.projectId : '';
	if (!projectId) {
		throw new NodeOperationError(
			this.getNode(),
			'Could not resolve project ID from API key context. Set Project ID in credentials.',
		);
	}
	return projectId;
}

function mapImazeoError(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	error: unknown,
): NodeApiError {
	const err = error as {
		message?: string;
		statusCode?: number;
		httpCode?: string | number;
		response?: { body?: unknown; statusCode?: number; headers?: IDataObject };
		cause?: { response?: { body?: unknown; statusCode?: number } };
	};

	const status =
		err.statusCode ??
		err.response?.statusCode ??
		err.cause?.response?.statusCode ??
		(typeof err.httpCode === 'number' ? err.httpCode : undefined);

	const body =
		(err.response?.body as IDataObject | undefined) ??
		(err.cause?.response?.body as IDataObject | undefined);

	const apiError = (body?.error as IDataObject | undefined) ?? {};
	const code = typeof apiError.code === 'string' ? apiError.code : undefined;
	const message =
		typeof apiError.message === 'string'
			? apiError.message
			: err.message ?? 'Imazeo request failed';
	const requestId =
		((body?.meta as IDataObject | undefined)?.requestId as string | undefined) ??
		pickHeader(err.response?.headers, 'x-request-id');

	const descriptionParts = [
		code ? `Code: ${code}` : undefined,
		requestId ? `Request ID: ${requestId}` : undefined,
		status === 429
			? 'Rate limit reached. Wait and retry with bounded backoff; honor Retry-After when present.'
			: undefined,
		status === 401
			? 'Check the X-API-Key value. Do not send Authorization together with the project key.'
			: undefined,
		status === 403
			? 'Confirm the project ID matches the key and that plan entitlements allow this operation.'
			: undefined,
	].filter(Boolean);

	return new NodeApiError(this.getNode(), error as JsonObject, {
		message,
		description: descriptionParts.join(' · ') || undefined,
		httpCode: status !== undefined ? String(status) : undefined,
	});
}

export async function getBinaryBuffer(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	return {
		buffer,
		fileName: binaryData.fileName || 'upload.bin',
		mimeType: binaryData.mimeType || 'application/octet-stream',
	};
}

export async function prepareBinaryItem(
	this: IExecuteFunctions,
	itemIndex: number,
	data: Buffer | ArrayBuffer | Uint8Array,
	fileName: string,
	mimeType: string,
	json: IDataObject = {},
	binaryPropertyName = 'data',
) {
	const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
	const binary = await this.helpers.prepareBinaryData(buffer, fileName, mimeType);
	return {
		json,
		binary: {
			[binaryPropertyName]: binary,
		},
		pairedItem: { item: itemIndex },
	};
}
