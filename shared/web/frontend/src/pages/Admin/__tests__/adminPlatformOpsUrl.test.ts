/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock deep-link helpers for Platform Ops Admin tabs.
 *
 * Related:
 * - `pages/Admin/platformOps/adminPlatformOpsUrl.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	isPlatformOpsAdminTab,
	readPlatformOpsAdminTabFromUrl,
} from '../platformOps/adminPlatformOpsUrl';

describe('adminPlatformOpsUrl', () => {
	it('accepts known tabs only', () => {
		expect(isPlatformOpsAdminTab('stack0')).toBe(true);
		expect(isPlatformOpsAdminTab('egress')).toBe(true);
		expect(isPlatformOpsAdminTab('portalPeers')).toBe(true);
		expect(isPlatformOpsAdminTab('apply')).toBe(false);
	});

	it('reads platformOpsTab from search', () => {
		expect(
			readPlatformOpsAdminTabFromUrl(
				'?section=platformOps&platformOpsTab=egress'
			)
		).toBe('egress');
		expect(
			readPlatformOpsAdminTabFromUrl(
				'?section=platformOps&platformOpsTab=portalPeers'
			)
		).toBe('portalPeers');
		expect(readPlatformOpsAdminTabFromUrl('?platformOpsTab=bogus')).toBeNull();
	});
});
