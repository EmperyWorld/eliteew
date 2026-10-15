import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { AppStoreEmptyCatalogPanel } from '../AppStoreEmptyCatalogPanel';

describe('AppStoreEmptyCatalogPanel', () => {
	it('offers category shortcuts when the current filter is empty', () => {
		const onSelectCategory = vi.fn();

		render(
			<AppStoreEmptyCatalogPanel
				t={((key: string) => key) as never}
				activeCategory="communication"
				debouncedSearch=""
				viewFilter="all"
				filtersActive
				suggestedCategories={[
					{ id: 'productivity', label: 'Productivity', count: 3 },
				]}
				onClearFilters={vi.fn()}
				onSelectCategory={onSelectCategory}
				onClearSearch={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Productivity/i }));
		expect(onSelectCategory).toHaveBeenCalledWith('productivity');
	});
});
