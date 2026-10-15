/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Regression tests for GAF Chat Content Manager attachment picker actions.
 *
 * Invariants:
 * - Attach action remains available outside the long scrollable file list.
 *
 * Related:
 * - `GafContentLibraryPickerPanel.tsx`
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PickerItem } from '@/components/UnifiedContent/picker/useUnifiedContentPickerController';
import { ContentType } from '@/types/fileExchange';
import { GafContentLibraryPickerPanel } from './GafContentLibraryPickerPanel';

const selectedItem: PickerItem = {
	id: 'content-1',
	name: 'brief.png',
	title: null,
	content_type: 'image',
	file_size: 2048,
	mime_type: 'image/png',
	created_at: '2026-05-28T00:00:00Z',
	updated_at: '2026-05-28T00:00:00Z',
	user_id: 'user-1',
	visibility: 'private',
	tags: [],
	_pickerContentType: ContentType.IMAGE,
};

const manyItems: PickerItem[] = Array.from({ length: 24 }, (_, index) => ({
	...selectedItem,
	id: `content-${index + 1}`,
	name: index === 0 ? selectedItem.name : `file-${index + 1}.png`,
}));

const clearSelection = vi.fn();
const setSelectedIds = vi.fn();
const toggleId = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string, values?: Record<string, unknown>) => {
			if (key === 'libraryPickerFilesCount') {
				return `files ${values?.count}`;
			}
			if (key === 'libraryPickerUpdatedAt') {
				return `updated ${values?.date}`;
			}
			return key;
		},
	}),
}));

vi.mock(
	'@/components/UnifiedContent/components/ContentThumbnail/ContentThumbnail',
	() => ({
		ContentThumbnail: ({ contentId }: { contentId: string }) => (
			<div data-testid={`thumb-${contentId}`} />
		),
	})
);

vi.mock('./GafChatImageInline', () => ({
	GafChatImageInline: ({ contentId }: { contentId: string }) => (
		<div data-testid={`image-${contentId}`} />
	),
}));

vi.mock(
	'@/components/UnifiedContent/picker/useUnifiedContentPickerController',
	() => ({
		useUnifiedContentPickerController: () => ({
			filteredItems: manyItems,
			selectedIds: ['content-1'],
			selectedItems: [selectedItem],
			availableTypes: [ContentType.IMAGE],
			filterType: 'all',
			setFilterType: vi.fn(),
			searchQuery: '',
			setSearchQuery: vi.fn(),
			searchPending: false,
			query: {
				isPending: false,
				isFetching: false,
				isError: false,
				error: null,
				data: { items: manyItems },
				refetch: vi.fn(),
			},
			setSelectedIds,
			toggleId,
			clearSelection,
		}),
	})
);

describe('GafContentLibraryPickerPanel', () => {
	it('renders attach controls in persistent action areas for long lists', () => {
		const onPick = vi.fn();

		render(
			<GafContentLibraryPickerPanel
				enabled
				onCancel={vi.fn()}
				onPick={onPick}
			/>
		);

		const attachButtons = screen.getAllByRole('button', {
			name: 'libraryPickerConfirm',
		});

		expect(attachButtons.length).toBeGreaterThanOrEqual(2);
		expect(screen.getAllByText('brief.png').length).toBeGreaterThan(0);

		fireEvent.click(attachButtons[0]);

		expect(onPick).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'content-1', name: 'brief.png' })
		);
		expect(clearSelection).toHaveBeenCalled();
	});
});
