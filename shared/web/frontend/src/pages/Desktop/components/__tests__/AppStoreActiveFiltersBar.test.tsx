import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { AppStoreActiveFiltersBar } from '../AppStoreActiveFiltersBar';

describe('AppStoreActiveFiltersBar', () => {
	it('removes the search chip independently', () => {
		const onClearSearch = vi.fn();

		render(
			<AppStoreActiveFiltersBar
				t={
					((
						key: string,
						opts?: { query?: string; name?: string; label?: string }
					) => {
						if (key === 'filters.chipSearch')
							return `Search: ${opts?.query ?? ''}`;
						return key;
					}) as never
				}
				debouncedSearch="chat"
				activeCategory="all"
				activeCategoryLabel="All"
				viewFilter="all"
				sortMode="catalog"
				onClearSearch={onClearSearch}
				onClearCategory={vi.fn()}
				onClearViewFilter={vi.fn()}
				onClearSort={vi.fn()}
				onClearAll={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Search: chat'));
		expect(onClearSearch).toHaveBeenCalledTimes(1);
	});
});
