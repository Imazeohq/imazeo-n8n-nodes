import helpers from '../nodes/Imazeo/GenericFunctions.ts';
import features from '../nodes/Imazeo/Features.ts';
import workflow from 'n8n-workflow';
const { NodeHelpers } = workflow;

const { buildTransformBody, extensionForContentType, normalizeBaseUrl, pickHeader, projectPath } =
	helpers;

function assertEqual(actual, expected) {
	if (actual !== expected) {
		throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
}

function assertDeepEqual(actual, expected) {
	const left = JSON.stringify(actual);
	const right = JSON.stringify(expected);
	if (left !== right) {
		throw new Error(`Expected ${right}, got ${left}`);
	}
}

function assertThrows(fn, pattern) {
	try {
		fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (pattern.test(message)) return;
		throw error;
	}
	throw new Error(`Expected throw matching ${pattern}`);
}

const cases = [
	[
		'record IDs are visible for conversion save and artifact operations',
		() => {
			const fields = features.featureProperties.filter(field => field.name === 'recordId');
			for (const [resource, operation] of [['conversion', 'save'], ['artifact', 'get'], ['artifact', 'download'], ['artifact', 'delete']]) {
				assertEqual(fields.some(field => NodeHelpers.displayParameter({ resource, operation }, field)), true);
			}
			assertEqual(fields.some(field => NodeHelpers.displayParameter({ resource: 'artifact', operation: 'save' }, field)), false);
		},
	],
	[
		'conversion request keeps quote, idempotency, upload bytes and false options',
		async () => {
			const requests = [];
			const params = {
				conversionEngine: 'xlsx',
				featureBinaryProperty: 'data',
				featureQuery: '{"showGridLines":false}',
				idempotencyKey: 'c37368a9-ed6f-4a78-9fb0-bb577368bde9',
				quoteId: 'b90144bd-1ef3-49db-84fc-28de61bb1e99',
			};
			const ctx = mockContext(params, requests);
			const result = await features.executeFeature.call(
				ctx,
				'conversion',
				'create',
				0,
				'https://api.imazeo.com',
				'project',
			);
			assertEqual(requests.length, 1);
			assertEqual(requests[0].url, 'https://api.imazeo.com/v1/projects/project/conversions/xlsx');
			assertEqual(requests[0].headers['Idempotency-Key'], params.idempotencyKey);
			assertEqual(requests[0].headers['X-Quote-ID'], params.quoteId);
			assertEqual(requests[0].headers['X-Upload-Length'], 3);
			assertEqual(requests[0].qs.showGridLines, false);
			assertEqual(requests[0].disableFollowRedirect, true);
			assertEqual(await requests[0].body.get('file').text(), 'abc');
			assertEqual(result[0].json.data.id, 'record');
		},
	],
	[
		'website conversion keeps URL in JSON and uses the selected engine',
		async () => {
			const requests = [];
			await features.executeFeature.call(
				mockContext(
					{
						conversionEngine: 'website',
						websiteUrl: 'https://imazeo.com',
						idempotencyKey: 'key',
						quoteId: 'quote',
					},
					requests,
				),
				'conversion',
				'create',
				0,
				'https://api.imazeo.com',
				'project',
			);
			assertDeepEqual(requests[0].body, { url: 'https://imazeo.com' });
			assertEqual(requests[0].headers['Content-Type'], 'application/json');
		},
	],
	[
		'missing conversion headers fail before sending',
		async () => {
			const requests = [];
			try {
				await features.executeFeature.call(
					mockContext({ conversionEngine: 'docx' }, requests),
					'conversion',
					'create',
					0,
					'https://api.imazeo.com',
					'project',
				);
			} catch (error) {
				assertEqual(requests.length, 0);
				if (/requires an idempotency key and quote ID/.test(error.message)) return;
				throw error;
			}
			throw new Error('Expected missing processing metadata to fail');
		},
	],
	[
		'dynamic updates send a revision and preserve false analytics settings',
		async () => {
			const requests = [];
			await features.executeFeature.call(
				mockContext(
					{
						recordId: 'code',
						idempotencyKey: 'key',
						featureBody: { expectedRevision: 0, analyticsEnabled: false, status: 'paused' },
					},
					requests,
				),
				'dynamicCode',
				'update',
				0,
				'https://api.imazeo.com',
				'project',
			);
			assertEqual(requests[0].method, 'PATCH');
			assertDeepEqual(requests[0].body, {
				expectedRevision: 0,
				analyticsEnabled: false,
				status: 'paused',
			});
		},
	],
	[
		'artifact save sends text fields and a JSON snapshot',
		async () => {
			const requests = [];
			await features.executeFeature.call(
				mockContext(
					{
						featureBody: {
							kind: 'qr',
							displayName: 'Company QR',
							contentType: 'image/png',
							requestSnapshot: { format: 'png' },
						},
					},
					requests,
				),
				'artifact',
				'save',
				0,
				'https://api.imazeo.com',
				'project',
			);
			assertEqual(requests[0].body.get('kind'), 'qr');
			assertEqual(requests[0].body.get('requestSnapshot'), '{"format":"png"}');
		},
	],
	[
		'feature query JSON rejects arrays and null',
		() => {
			assertThrows(() => features.parseObject('[]'), /JSON object/);
			assertThrows(() => features.parseObject('null'), /JSON object/);
		},
	],
	[
		'normalizeBaseUrl keeps production origin',
		() => {
			assertEqual(normalizeBaseUrl('https://api.imazeo.com'), 'https://api.imazeo.com');
		},
	],
	[
		'normalizeBaseUrl strips trailing slash and accidental /v1',
		() => {
			assertEqual(normalizeBaseUrl('https://api.imazeo.com/v1/'), 'https://api.imazeo.com');
		},
	],
	[
		'normalizeBaseUrl rejects credentials in the URL',
		() => {
			assertThrows(() => normalizeBaseUrl('https://user:pass@api.imazeo.com'), /credentials/);
		},
	],
	[
		'projectPath builds versioned project paths',
		() => {
			assertEqual(
				projectPath('https://api.imazeo.com', 'proj-1', 'tools', 'qr'),
				'https://api.imazeo.com/v1/projects/proj-1/tools/qr',
			);
		},
	],
	[
		'buildTransformBody builds imageId requests with transform options',
		() => {
			const body = buildTransformBody({
				sourceMode: 'imageId',
				imageId: 'img_1',
				mode: 'CACHE',
				width: 320,
				format: 'webp',
				flip: true,
			});
			assertDeepEqual(body, {
				imageId: 'img_1',
				mode: 'CACHE',
				transform: {
					width: 320,
					format: 'webp',
					flip: true,
				},
			});
		},
	],
	[
		'buildTransformBody requires exactly one source',
		() => {
			assertThrows(() => buildTransformBody({ sourceMode: 'url' }), /Image URL/);
		},
	],
	[
		'extensionForContentType maps content types',
		() => {
			assertEqual(extensionForContentType('image/png; charset=binary'), 'png');
			assertEqual(extensionForContentType('application/pdf'), 'pdf');
		},
	],
	[
		'pickHeader reads headers case-insensitively',
		() => {
			assertEqual(pickHeader({ 'X-Request-Id': 'abc' }, 'x-request-id'), 'abc');
		},
	],
];

let failed = 0;
for (const [name, run] of cases) {
	try {
		await run();
		console.log(`ok - ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`not ok - ${name}`);
		console.error(error);
	}
}

if (failed > 0) {
	console.error(`${failed} failed`);
	process.exit(1);
}

console.log(`${cases.length} passed`);

function mockContext(params, requests) {
	return {
		getNode: () => ({
			name: 'Imazeo',
			type: 'imazeo',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name, _i, fallback) => params[name] ?? fallback,
		helpers: {
			assertBinaryData: () => ({ fileName: 'document.xlsx', mimeType: 'application/octet-stream' }),
			getBinaryDataBuffer: async () => Buffer.from('abc'),
			httpRequestWithAuthentication: async (_credential, request) => {
				requests.push(request);
				return {
					statusCode: 200,
					headers: { 'content-type': 'application/json' },
					body: { success: true, data: { id: 'record' }, meta: { requestId: 'request' } },
				};
			},
		},
	};
}
