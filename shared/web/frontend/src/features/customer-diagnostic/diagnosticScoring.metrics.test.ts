import { describe, expect, it } from 'vitest';

import { computeModuleMetrics } from './diagnosticScoring';

describe('computeModuleMetrics', () => {
	it('returns archetype block when answers present', () => {
		const out = computeModuleMetrics('archetype', {
			archetype: { '1': 2, '2': 1 },
		});
		expect(out.archetype).toBeDefined();
		expect(out.archetype).toMatchObject({
			dominant: expect.objectContaining({
				percentage: expect.any(Number),
			}),
		});
	});

	it('returns empty-friendly structure for empty module answers', () => {
		const out = computeModuleMetrics('values', {});
		expect(out.values).toBeNull();
	});
});
