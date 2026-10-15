import { describe, expect, it } from 'vitest';
import { getStoreAppGradientBarClass } from '../storeCatalogGradients';

describe('storeCatalogGradients', () => {
	it('maps legacy zinc/slate keys to desktop-accent gradients (no zinc class in output)', () => {
		const z = getStoreAppGradientBarClass(
			'from-zinc-600 to-zinc-800',
			'system'
		);
		expect(z).toContain('--desktop-accent-rgb');
		expect(z).not.toMatch(/zinc-/i);

		const s = getStoreAppGradientBarClass(
			'from-slate-500 to-gray-600',
			'system'
		);
		expect(s).toContain('--desktop-accent-rgb');
		expect(s).not.toMatch(/slate-|gray-/i);
	});

	it('system category uses accent wash, not slate/zinc', () => {
		const c = getStoreAppGradientBarClass(null, 'system');
		expect(c).toContain('--desktop-accent-rgb');
		expect(c).not.toMatch(/slate-|zinc-/i);
	});
});
