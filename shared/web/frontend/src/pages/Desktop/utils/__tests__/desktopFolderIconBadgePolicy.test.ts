/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Policy locks: system library folders never get desktop icon count badges.
 *
 * Related:
 * - ../desktopFolderIconBadgePolicy.ts
 */

import { describe, expect, it } from 'vitest';
import {
	filterFolderIconBadgeCountsForDesktop,
	shouldShowDesktopFolderCountBadge,
} from '../desktopFolderIconBadgePolicy';

describe('desktopFolderIconBadgePolicy', () => {
	it('suppresses system library roots', () => {
		expect(
			shouldShowDesktopFolderCountBadge({
				id: 'content',
				type: 'folder',
				isSystem: true,
			})
		).toBe(false);
		expect(
			shouldShowDesktopFolderCountBadge({
				id: 'documents',
				type: 'folder',
			})
		).toBe(false);
		expect(
			shouldShowDesktopFolderCountBadge({
				id: 'trash',
				type: 'folder',
			})
		).toBe(false);
	});

	it('allows user-created folders', () => {
		expect(
			shouldShowDesktopFolderCountBadge({
				id: 'my-folder',
				type: 'folder',
			})
		).toBe(true);
	});

	it('filters merged counts for desktop icons', () => {
		expect(
			filterFolderIconBadgeCountsForDesktop(
				{
					content: 120,
					documents: 18,
					'my-folder': 3,
					images: 99,
				},
				[
					{ id: 'content', type: 'folder', isSystem: true },
					{ id: 'documents', type: 'folder', isSystem: true },
					{ id: 'my-folder', type: 'folder' },
					{ id: 'images', type: 'folder', isSystem: true },
				]
			)
		).toEqual({ 'my-folder': 3 });
	});
});
