/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests Content Manager bulk action eligibility partitions.
 *
 * Invariants:
 * - Explicitly blocked edit/delete permissions remain ineligible.
 *
 * Related:
 * - contentManagerBulkEligibility.ts
 */
import { describe, expect, it } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	partitionSelectedByDeleteEligibility,
	partitionSelectedByEligibility,
} from './contentManagerBulkEligibility';

function item(
	overrides: Partial<ContentItem> & Pick<ContentItem, 'id'>
): ContentItem {
	return {
		name: overrides.name ?? 'file.txt',
		content_type: overrides.content_type ?? 'document',
		file_size: overrides.file_size ?? 100,
		mime_type: overrides.mime_type ?? 'text/plain',
		created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
		updated_at: overrides.updated_at ?? '2026-01-01T00:00:00Z',
		user_id: overrides.user_id ?? 'user-1',
		visibility: overrides.visibility ?? 'private',
		tags: overrides.tags ?? [],
		...overrides,
	};
}

describe('partitionSelectedByEligibility', () => {
	it('returns eligible owned editable items', () => {
		const items = [
			item({ id: 'a', is_owner: true, can_edit: true }),
			item({ id: 'b', is_owner: true, can_edit: undefined }),
		];
		const result = partitionSelectedByEligibility(items, ['a', 'b']);
		expect(result.eligible.map((i) => i.id)).toEqual(['a', 'b']);
		expect(result.ineligible).toHaveLength(0);
	});

	it('partitions not_owner and read_only rows', () => {
		const items = [
			item({ id: 'owned', is_owner: true, can_edit: true }),
			item({ id: 'shared', is_owner: false, can_edit: true }),
			item({ id: 'ro', is_owner: true, can_edit: false }),
		];
		const result = partitionSelectedByEligibility(items, [
			'owned',
			'shared',
			'ro',
			'missing',
		]);
		expect(result.eligible.map((i) => i.id)).toEqual(['owned']);
		expect(result.ineligible).toEqual([
			{ item: items[1], reason: 'not_owner' },
			{ item: items[2], reason: 'read_only' },
		]);
	});

	it('accepts Set selected ids', () => {
		const items = [item({ id: 'x' })];
		const result = partitionSelectedByEligibility(items, new Set(['x']));
		expect(result.eligible).toHaveLength(1);
	});
});

describe('partitionSelectedByDeleteEligibility', () => {
	it('keeps only selected rows that do not explicitly forbid deletion', () => {
		const items = [
			item({ id: 'allowed', can_delete: true }),
			item({ id: 'default-allowed', can_delete: undefined }),
			item({ id: 'blocked', can_delete: false }),
		];

		const result = partitionSelectedByDeleteEligibility(items, [
			'allowed',
			'default-allowed',
			'blocked',
			'missing',
		]);

		expect(result.eligible.map((entry) => entry.id)).toEqual([
			'allowed',
			'default-allowed',
		]);
		expect(result.ineligible.map((entry) => entry.id)).toEqual(['blocked']);
	});
});
