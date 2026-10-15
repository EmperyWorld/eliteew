/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Regression tests for Unified Content picker persistent selection actions.
 *
 * Invariants:
 * - Confirm remains available above the scrollable list after a selection.
 *
 * Related:
 * - `UnifiedContentPickerPanel.tsx`
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentType } from '@/types/fileExchange';
import type { PickerItem } from './useUnifiedContentPickerController';
import { UnifiedContentPickerPanel } from './UnifiedContentPickerPanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) => {
			if (key === 'selectedCounter') {
				return `selected ${values?.count} / ${values?.max}`;
			}
			if (key === 'filesFound') {
				return `files ${values?.count}`;
			}
			if (key === 'confirm') {
				return `confirm ${values?.count}`;
			}
			return key;
		},
	}),
}));

vi.mock('../components/ContentThumbnail/ContentThumbnail', () => ({
	ContentThumbnail: ({ contentId }: { contentId: string }) => (
		<div data-testid={`thumb-${contentId}`} />
	),
}));

const item = (id: string): PickerItem => ({
	id,
	name: `File ${id}`,
	title: null,
	content_type: 'image',
	file_size: 1024,
	mime_type: 'image/png',
	created_at: '2026-05-28T00:00:00Z',
	updated_at: '2026-05-28T00:00:00Z',
	user_id: 'user-1',
	visibility: 'private',
	tags: [],
	_pickerContentType: ContentType.IMAGE,
});

describe('UnifiedContentPickerPanel', () => {
	it('renders a persistent confirm action when files are selected', () => {
		render(
			<UnifiedContentPickerPanel
				filteredItems={[item('1'), item('2')]}
				isLoading={false}
				isFetching={false}
				isError={false}
				onRetry={vi.fn()}
				searchQuery=""
				onSearchChange={vi.fn()}
				searchPending={false}
				showTypeFilter
				filterType="all"
				onFilterTypeChange={vi.fn()}
				availableTypes={[ContentType.IMAGE]}
				multiSelect
				maxFiles={10}
				selectedIds={['1']}
				onToggleId={vi.fn()}
				onSelectAllVisible={vi.fn()}
				onDeselectAll={vi.fn()}
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
				showFooter
			/>
		);

		expect(screen.getAllByText('selected 1 / 10').length).toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: /confirm 1/ }).length).toBe(2);
	});
});
