import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Aligned with `shared/api/routers/voice_gateway.py` router prefix. */
const VOICE_GATEWAY_V1 = '/api/v1/voice-gateway';

const PILOT = join(
	__dirname,
	'../../../../openapi/pilot/voice-gateway.openapi.json'
);

describe('voice-gateway path contract', () => {
	it('canonical STT/TTS/health paths', () => {
		expect(`${VOICE_GATEWAY_V1}/transcribe`).toBe(
			'/api/v1/voice-gateway/transcribe'
		);
		expect(`${VOICE_GATEWAY_V1}/synthesize`).toBe(
			'/api/v1/voice-gateway/synthesize'
		);
		expect(`${VOICE_GATEWAY_V1}/voices`).toBe('/api/v1/voice-gateway/voices');
		expect(`${VOICE_GATEWAY_V1}/health`).toBe('/api/v1/voice-gateway/health');
		expect(`${VOICE_GATEWAY_V1}/process`).toBe('/api/v1/voice-gateway/process');
		expect(`${VOICE_GATEWAY_V1}/map-intent`).toBe(
			'/api/v1/voice-gateway/map-intent'
		);
	});

	it('OpenAPI pilot includes voice-gateway routes', () => {
		type PathItem = Partial<
			Record<'get' | 'post' | 'patch' | 'put' | 'delete', unknown>
		>;
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, PathItem | undefined>;
		};
		expect(spec.paths['/api/v1/voice-gateway/transcribe']?.post).toBeDefined();
		expect(spec.paths['/api/v1/voice-gateway/synthesize']?.post).toBeDefined();
		expect(spec.paths['/api/v1/voice-gateway/voices']?.get).toBeDefined();
		expect(spec.paths['/api/v1/voice-gateway/health']?.get).toBeDefined();
		expect(spec.paths['/api/v1/voice-gateway/process']?.post).toBeDefined();
	});
});
