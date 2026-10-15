/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock tray membership and alert-badge policy without inventory count hacks.
 *
 * Related:
 * - ../desktopTraySurfacePolicy.ts
 */

import { describe, expect, it } from 'vitest';
import {
	resolveTraySurfaceBadge,
	shouldIncludeGafTrayRow,
} from '../desktopTraySurfacePolicy';

describe('desktopTraySurfacePolicy', () => {
	it('includes GAF only for unread or minimized window', () => {
		expect(shouldIncludeGafTrayRow({ gafUnread: 0, gafMinimized: false })).toBe(
			false
		);
		expect(shouldIncludeGafTrayRow({ gafUnread: 2, gafMinimized: false })).toBe(
			true
		);
		expect(shouldIncludeGafTrayRow({ gafUnread: 0, gafMinimized: true })).toBe(
			true
		);
	});

	it('exposes unread badge only — never inventory count', () => {
		expect(resolveTraySurfaceBadge({ gafUnread: 0 })).toEqual({
			kind: 'none',
		});
		expect(resolveTraySurfaceBadge({ gafUnread: 3 })).toEqual({
			kind: 'unread',
			count: 3,
		});
	});
});
