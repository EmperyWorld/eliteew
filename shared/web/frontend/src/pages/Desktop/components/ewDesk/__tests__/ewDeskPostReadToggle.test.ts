/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWDesk read/unread toggle resolution.
 */

import { describe, expect, it } from 'vitest';
import { resolveEwDeskPostReadToggleAction } from '../ewDeskPostReadToggle';

describe('resolveEwDeskPostReadToggleAction', () => {
	it('marks unread when post is already read', () => {
		expect(
			resolveEwDeskPostReadToggleAction('post-1', new Set(['post-1']))
		).toBe('mark_unread');
	});

	it('marks read when post is not in read set', () => {
		expect(resolveEwDeskPostReadToggleAction('post-2', new Set())).toBe(
			'mark_read'
		);
	});
});
