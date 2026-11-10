import helpers from '../nodes/Imazeo/GenericFunctions.ts';

const {
	buildTransformBody,
	extensionForContentType,
	normalizeBaseUrl,
	pickHeader,
	projectPath,
} = helpers;

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
		run();
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
