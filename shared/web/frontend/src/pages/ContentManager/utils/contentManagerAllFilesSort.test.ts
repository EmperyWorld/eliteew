import { describe, expect, it } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { sortItemsByNewestUpdatedFirst } from './contentManagerAllFilesSort';

function item(id: string, updated: string, created = updated): ContentItem {
	return {
		id,
		name: id,
		content_type: 'document',
		file_size: 0,
		mime_type: null,
		created_at: created,
		updated_at: updated,
		user_id: 'u',
		visibility: 'private',
		tags: [],
	} as ContentItem;
}

describe('sortItemsByNewestUpdatedFirst', () => {
	it('orders by updated_at descending', () => {
		const rows = [
			item('a', '2024-01-01T00:00:00Z'),
			item('b', '2025-06-01T00:00:00Z'),
			item('c', '2025-01-01T00:00:00Z'),
		];
		sortItemsByNewestUpdatedFirst(rows);
		expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
	});
});
