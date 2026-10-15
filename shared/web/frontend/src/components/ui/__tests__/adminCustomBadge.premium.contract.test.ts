/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock admin custom badge chrome: sentence-case ALL-CAPS labels, no CSS uppercase.
 *
 * Invariants:
 * - formatAdminBadgeLabel('FOUNDER') → 'Founder'.
 * - Badge className has no `uppercase`.
 *
 * Related:
 * - ../AdminCustomBadge.tsx
 * - documentation/product/SOCIAL-HUB.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatAdminBadgeLabel } from '../AdminCustomBadge';

const here = dirname(fileURLToPath(import.meta.url));

describe('adminCustomBadge.premium.contract', () => {
	it('sentence-cases ALL-CAPS admin labels', () => {
		expect(formatAdminBadgeLabel('FOUNDER')).toBe('Founder');
		expect(formatAdminBadgeLabel('VIP')).toBe('VIP');
		expect(formatAdminBadgeLabel('Founder')).toBe('Founder');
		expect(formatAdminBadgeLabel(' co-founder ')).toBe('co-founder');
	});

	it('keeps badge chrome without uppercase class', () => {
		const src = readFileSync(join(here, '../AdminCustomBadge.tsx'), 'utf8');
		expect(src).toMatch(/tracking-normal/);
		expect(src).not.toMatch(
			/bg-violet-500\/10[^']*\buppercase\b|uppercase[^']*bg-violet-500\/10/
		);
	});
});
