/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionActionsTray (U8.3 slice 6 extract).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CompanionActionRecord } from '@/features/ewa/companionActionTrayUi';
import { CompanionActionsTray } from '@/features/ewa/companionUx/CompanionActionsTray';

const openRecord: CompanionActionRecord = {
	id: 'open-doc',
	kind: 'open',
	appComponent: 'DocEditor',
	closed: false,
};

describe('CompanionActionsTray', () => {
	it('renders collapsed summary and expands on click', () => {
		render(
			<CompanionActionsTray
				records={[openRecord]}
				expanded={false}
				onToggleExpanded={vi.fn()}
				onUndo={vi.fn()}
				onFocusRun={vi.fn()}
			/>
		);
		expect(
			screen.getByTestId('ewa-companion-actions-tray')
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { expanded: false }));
	});

	it('calls onUndo for undo button', () => {
		const onUndo = vi.fn();
		render(
			<CompanionActionsTray
				records={[openRecord]}
				expanded={true}
				onToggleExpanded={vi.fn()}
				onUndo={onUndo}
				onFocusRun={vi.fn()}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Отменить авто-действие спутника' })
		);
		expect(onUndo).toHaveBeenCalledWith(openRecord);
	});

	it('renders web search result links', () => {
		render(
			<CompanionActionsTray
				records={[
					{
						id: 'web-search',
						kind: 'web_search',
						appComponent: '',
						closed: false,
						rationale: 'ключевая ставка',
						webSearchResult: {
							query: 'ключевая ставка',
							result_count: 1,
							results: [
								{
									title: 'Central bank update',
									url: 'https://example.test/rate',
									snippet: 'Latest rate summary',
								},
							],
						},
					},
				]}
				expanded={true}
				onToggleExpanded={vi.fn()}
				onUndo={vi.fn()}
				onFocusRun={vi.fn()}
			/>
		);

		const link = screen.getByRole('link', { name: 'Central bank update' });
		expect(link).toHaveAttribute('href', 'https://example.test/rate');
		expect(screen.getByText('Latest rate summary')).toBeInTheDocument();
	});
});
