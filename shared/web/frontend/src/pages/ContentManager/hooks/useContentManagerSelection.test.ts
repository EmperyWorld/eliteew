/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests useContentManagerSelection bulk selection helpers.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { useContentManagerSelection } from './useContentManagerSelection';

vi.mock('../../../services/contentApi', () => ({
	contentApi: {
		deleteContent: vi.fn(),
		batchDownloadToBrowser: vi.fn(),
		updateContent: vi.fn(),
	},
}));

const t = ((key: string) => key) as never;

function item(id: string): ContentItem {
	return {
		id,
		name: id,
		content_type: 'document',
		file_size: 0,
		mime_type: null,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		user_id: 'u',
		visibility: 'private',
	} as ContentItem;
}

describe('useContentManagerSelection', () => {
	it('selectAllVisible selects filtered ids', () => {
		const filtered = [item('a'), item('b')];
		const { result } = renderHook(() =>
			useContentManagerSelection({
				t,
				filteredItems: filtered,
				items: filtered,
				filesBrowseMode: 'explorer',
				groupBy: 'none',
				currentPage: 1,
				setItems: vi.fn(),
				setTotalItems: vi.fn(),
				setError: vi.fn(),
				setSuccess: vi.fn(),
				onAfterBulkMutation: vi.fn(),
				assignCompanyId: '',
				assignProjectId: '',
				setAssignTenancyOpen: vi.fn(),
				setAssignTenancyLoading: vi.fn(),
			})
		);

		act(() => {
			result.current.selectAllVisible();
		});

		expect(result.current.selectedIds.size).toBe(2);
		expect(result.current.selectedIds.has('a')).toBe(true);
	});
});
