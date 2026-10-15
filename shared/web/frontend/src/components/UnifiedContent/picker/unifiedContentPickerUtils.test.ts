import { describe, expect, it } from 'vitest';
import type { Content } from '@/components/UnifiedContent/types';
import { ContentType } from '@/types/fileExchange';
import { stripPickerItemMeta } from './stripPickerItemMeta';
import { unifiedContentPickerQueryKey } from './unifiedContentPickerQueryKey';
import type { PickerItem } from './useUnifiedContentPickerController';

describe('unifiedContentPickerQueryKey', () => {
	it('is stable for equivalent queries and differs on owner_only', () => {
		const a = unifiedContentPickerQueryKey({
			limit: 100,
			offset: 0,
			owner_only: true,
		});
		const b = unifiedContentPickerQueryKey({
			limit: 100,
			offset: 0,
			owner_only: true,
		});
		const c = unifiedContentPickerQueryKey({
			limit: 100,
			offset: 0,
			owner_only: false,
		});
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
	});
});

describe('stripPickerItemMeta', () => {
	it('removes picker-only field', () => {
		const base: Content = {
			id: 'c1',
			name: 'x.pdf',
			content_type: 'document',
			file_size: 10,
			mime_type: 'application/pdf',
			created_at: new Date(0).toISOString(),
			updated_at: new Date(0).toISOString(),
			user_id: 'u1',
			visibility: 'private',
			tags: [],
		};
		const item: PickerItem = {
			...base,
			_pickerContentType: ContentType.DOCUMENT,
		};
		const out = stripPickerItemMeta([item]);
		expect(out).toHaveLength(1);
		const first = out[0];
		expect(first).toBeDefined();
		expect(first).toEqual(base);
		if (first) {
			expect('_pickerContentType' in first).toBe(false);
		}
	});
});
