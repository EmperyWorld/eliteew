import { describe, expect, it, vi } from 'vitest';

import { createEwrpIdempotencyKey } from './ewrpIdempotency';

describe('createEwrpIdempotencyKey', () => {
	it('uses crypto.randomUUID when available', () => {
		vi.stubGlobal('crypto', {
			randomUUID: () => '00000000-0000-4000-8000-000000000001',
		});
		expect(createEwrpIdempotencyKey()).toBe(
			'00000000-0000-4000-8000-000000000001'
		);
		vi.unstubAllGlobals();
	});

	it('falls back when randomUUID is missing', () => {
		vi.stubGlobal('crypto', {});
		const k = createEwrpIdempotencyKey();
		expect(k.length).toBeGreaterThan(8);
		expect(k).toMatch(/^\d+-[a-z0-9]+$/);
		vi.unstubAllGlobals();
	});
});
