/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Professional Worlds admin pack diff presentation grouping.
 *
 * Invariants:
 * - Tests assert operator-facing grouping behavior, not card markup details.
 *
 * Related:
 * - tabs/PacksTab.tsx
 */

import { describe, expect, it } from 'vitest';

import { diffGroups } from './tabs/PacksTab';

describe('admin pack diff grouping', () => {
	it('separates added, changed, disabled and risky sections', () => {
		const groups = diffGroups({
			sections: {
				modules: { live_count: 1, incoming_count: 3 },
				schemas: { live_count: 2, incoming_count: 2 },
				photo_presets: { live_count: 4, incoming_count: 1 },
				integrations: { live_count: 0, incoming_count: 0 },
			},
			risks: ['schema change requires review', 'disabled module detected'],
		});

		expect(groups.added).toEqual(['modules: +2']);
		expect(groups.changed).toEqual(['schemas: 2 candidate row(s)']);
		expect(groups.disabled).toEqual(['photo_presets: -3']);
		expect(groups.risky).toEqual([
			'schema change requires review',
			'disabled module detected',
		]);
	});

	it('does not mark empty unchanged sections as changed', () => {
		const groups = diffGroups({
			sections: {
				integrations: { live_count: 0, incoming_count: 0 },
			},
			risks: [],
		});

		expect(groups).toEqual({
			added: [],
			changed: [],
			disabled: [],
			risky: [],
		});
	});
});
