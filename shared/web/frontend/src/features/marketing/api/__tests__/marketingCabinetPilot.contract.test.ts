import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FRONTEND_ROOT = join(__dirname, '../../../../..');
const PILOT = join(
	FRONTEND_ROOT,
	'openapi/pilot/marketing-cabinet.openapi.json'
);
const PATHS_MANIFEST = join(
	FRONTEND_ROOT,
	'openapi/pilot-marketing-cabinet-paths.json'
);

describe('marketing-cabinet pilot contract', () => {
	it('pilot paths match openapi/pilot-marketing-cabinet-paths.json (single source)', () => {
		const { paths: expectedPaths } = JSON.parse(
			readFileSync(PATHS_MANIFEST, 'utf8')
		) as { paths: string[] };
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, unknown>;
		};
		for (const p of expectedPaths) {
			expect(
				spec.paths[p],
				`expected ${p} in openapi/pilot/marketing-cabinet.openapi.json`
			).toBeDefined();
		}
		expect(Object.keys(spec.paths).length).toBe(expectedPaths.length);
	});
});
