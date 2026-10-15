/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component tests for runtime disabled-reasons hint card UX.
 *
 * Invariants:
 * - Toggle is shown only when grouped summary differs from raw entries.
 * - Expanded details state persists across remount via session storage key.
 * - Raw list stays hidden by default in compact mode.
 *
 * Related:
 * - `pages/Desktop/components/RuntimeDisabledActionsHintCard.tsx`
 * - `pages/Kirs/KirsPage.tsx`
 * - `features/site-studio/desktop/components/SiteStudioRuntimePanel.tsx`
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeDisabledActionsHintCard } from '../RuntimeDisabledActionsHintCard';

describe('RuntimeDisabledActionsHintCard', () => {
	it('shows grouped summary and reveals per-action details via toggle', () => {
		const onToggleRawHints = vi.fn();
		render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Start site: Operation is in progress.',
					'Stop site: Operation is in progress.',
				]}
				showRawToggle
				rawListTitle="Per-action details"
				toggleShowRawLabel="Show detailed list"
				toggleHideRawLabel="Hide detailed list"
				onToggleRawHints={onToggleRawHints}
			/>
		);

		const summaryList = screen.getByRole('list', { name: 'Runtime reasons' });
		const summaryItems = within(summaryList).getAllByRole('listitem');
		expect(summaryItems).toHaveLength(1);
		expect(summaryItems[0]).toHaveClass('py-1.5');
		expect(summaryItems[0]).toHaveTextContent('Start site');
		expect(summaryItems[0]).toHaveTextContent('Stop site');
		expect(summaryItems[0]).toHaveTextContent('Operation is in progress.');
		expect(
			screen.getByTestId('runtime-disabled-grouped-count')
		).toHaveTextContent('Reasons 1');
		expect(
			screen.getByTestId('runtime-disabled-hidden-count')
		).toHaveTextContent('Hidden +1');
		expect(screen.getByTestId('runtime-disabled-counts-sr')).toHaveTextContent(
			'1 grouped reason. 1 hidden detail.'
		);
		expect(
			screen.queryByRole('list', { name: 'Per-action details' })
		).not.toBeInTheDocument();
		const showDetailsButton = screen.getByRole('button', {
			name: /Show detailed list \(1\)/,
		});
		const toggleAnnouncement = screen.getByTestId(
			'runtime-disabled-toggle-announcement'
		);
		expect(toggleAnnouncement).toHaveTextContent('');
		expect(showDetailsButton).toHaveAttribute('aria-expanded', 'false');
		const detailsRegionId = showDetailsButton.getAttribute('aria-controls');
		expect(detailsRegionId).toBeTruthy();
		const collapsedDetailsRegion = screen.getByRole('region', {
			hidden: true,
		});
		expect(collapsedDetailsRegion.id).toBe(detailsRegionId);
		expect(collapsedDetailsRegion).toHaveAttribute(
			'aria-label',
			'Per-action details'
		);
		expect(collapsedDetailsRegion).toHaveAttribute('hidden');
		expect(collapsedDetailsRegion).toHaveAttribute('aria-hidden', 'true');

		fireEvent.click(showDetailsButton);
		expect(onToggleRawHints).toHaveBeenCalledTimes(1);
		expect(onToggleRawHints).toHaveBeenCalledWith({
			isExpanded: true,
			rawCount: 2,
			collapsedCount: 1,
			hiddenCount: 1,
		});
		expect(toggleAnnouncement).toHaveTextContent(
			'Detailed list expanded (2 rows)'
		);

		expect(
			screen.getByRole('button', { name: 'Hide detailed list' })
		).toBeInTheDocument();
		const detailsRegion = screen.getByRole('region');
		expect(detailsRegion.id).toBe(detailsRegionId);
		expect(detailsRegion).toHaveAttribute('aria-label', 'Per-action details');
		expect(detailsRegion).not.toHaveAttribute('hidden');
		expect(detailsRegion).toHaveAttribute('aria-hidden', 'false');
		const detailsList = within(detailsRegion).getByRole('list', {
			name: 'Per-action details',
		});
		expect(
			screen.getByTestId('runtime-disabled-details-count')
		).toHaveTextContent('Rows 2');
		const detailItems = within(detailsList).getAllByRole('listitem');
		expect(detailItems).toHaveLength(2);
		expect(detailItems[0]).toHaveTextContent('Start site');
		expect(detailItems[0]).toHaveTextContent('Operation is in progress.');
		expect(detailItems[1]).toHaveTextContent('Stop site');
		expect(detailItems[1]).toHaveTextContent('Operation is in progress.');
		fireEvent.click(screen.getByRole('button', { name: 'Hide detailed list' }));
		expect(onToggleRawHints).toHaveBeenCalledTimes(2);
		expect(onToggleRawHints).toHaveBeenLastCalledWith({
			isExpanded: false,
			rawCount: 2,
			collapsedCount: 1,
			hiddenCount: 1,
		});
		expect(toggleAnnouncement).toHaveTextContent(
			'Detailed list collapsed (2 rows)'
		);
	});

	it('persists expanded state across remount when storage key is set', () => {
		const storageKey = 'runtime.hints.card.persisted';
		window.sessionStorage.removeItem(storageKey);

		const props = {
			title: 'Runtime reasons',
			hints: [
				'Start site: Operation is in progress.',
				'Stop site: Operation is in progress.',
			],
			showRawToggle: true,
			rawListTitle: 'Per-action details',
			toggleShowRawLabel: 'Show detailed list',
			toggleHideRawLabel: 'Hide detailed list',
			toggleStateStorageKey: storageKey,
		};

		const { unmount } = render(<RuntimeDisabledActionsHintCard {...props} />);
		fireEvent.click(
			screen.getByRole('button', { name: /Show detailed list \(1\)/ })
		);
		expect(window.sessionStorage.getItem(storageKey)).toBe('1');
		expect(screen.getByText('Per-action details')).toBeInTheDocument();

		unmount();
		render(<RuntimeDisabledActionsHintCard {...props} />);
		expect(
			screen.getByRole('button', { name: 'Hide detailed list' })
		).toBeInTheDocument();
		expect(screen.getByText('Per-action details')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Hide detailed list' }));
		expect(window.sessionStorage.getItem(storageKey)).toBeNull();
	});

	it('resets expanded preference when detailed toggle is no longer applicable', () => {
		const storageKey = 'runtime.hints.card.dynamic-toggle';
		window.sessionStorage.removeItem(storageKey);

		const groupedProps = {
			title: 'Runtime reasons',
			hints: [
				'Start site: Operation is in progress.',
				'Stop site: Operation is in progress.',
			],
			showRawToggle: true,
			rawListTitle: 'Per-action details',
			toggleShowRawLabel: 'Show detailed list',
			toggleHideRawLabel: 'Hide detailed list',
			toggleStateStorageKey: storageKey,
		};

		const { rerender } = render(
			<RuntimeDisabledActionsHintCard {...groupedProps} />
		);
		fireEvent.click(
			screen.getByRole('button', { name: /Show detailed list \(1\)/ })
		);
		expect(window.sessionStorage.getItem(storageKey)).toBe('1');
		expect(screen.getByText('Per-action details')).toBeInTheDocument();

		rerender(
			<RuntimeDisabledActionsHintCard
				{...groupedProps}
				hints={[
					'Start site: Site already running.',
					'Redeploy site: Start site first.',
				]}
			/>
		);
		expect(
			screen.queryByRole('button', { name: /Hide detailed list/ })
		).not.toBeInTheDocument();
		expect(window.sessionStorage.getItem(storageKey)).toBeNull();

		rerender(<RuntimeDisabledActionsHintCard {...groupedProps} />);
		expect(
			screen.getByRole('button', { name: /Show detailed list \(1\)/ })
		).toBeInTheDocument();
		expect(
			screen.queryByRole('list', { name: 'Per-action details' })
		).not.toBeInTheDocument();
	});

	it('hides toggle when reasons are already distinct', () => {
		render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Start site: Site already running.',
					'Redeploy site: Start site first.',
				]}
				showRawToggle
				toggleShowRawLabel="Show detailed list"
			/>
		);

		expect(
			screen.queryByRole('button', { name: /Show detailed list/ })
		).not.toBeInTheDocument();
	});

	it('supports compact row density for summary and details rows', () => {
		render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Action 1: Operation is in progress.',
					'Action 2: Operation is in progress.',
					'Action 3: Operation is in progress.',
				]}
				showRawToggle
				rowDensity="compact"
				rawListTitle="Per-action details"
				toggleShowRawLabel="Show detailed list"
				toggleHideRawLabel="Hide detailed list"
			/>
		);
		const summaryList = screen.getByTestId('runtime-disabled-summary-list');
		expect(summaryList).toHaveClass('space-y-1');
		const summaryItems = within(summaryList).getAllByRole('listitem');
		expect(summaryItems[0]).toHaveClass('py-1');
		expect(summaryItems[0]).not.toHaveClass('py-1.5');

		fireEvent.click(screen.getByRole('button', { name: /Show detailed list/ }));
		const detailsList = screen.getByTestId('runtime-disabled-details-list');
		expect(detailsList).toHaveClass('space-y-1');
		const detailItems = within(detailsList).getAllByRole('listitem');
		expect(detailItems[0]).toHaveClass('py-1');
		expect(detailItems[0]).not.toHaveClass('py-1.5');
	});

	it('supports custom screen-reader count formatters', () => {
		render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Action 1: Operation is in progress.',
					'Action 2: Operation is in progress.',
				]}
				showRawToggle
				groupedCountSrFormatter={(count) => `Grouped custom ${count}`}
				hiddenCountSrFormatter={(count) => `Hidden custom ${count}`}
			/>
		);
		expect(screen.getByTestId('runtime-disabled-counts-sr')).toHaveTextContent(
			'Grouped custom 1. Hidden custom 1.'
		);
	});

	it('respects custom scroll threshold for summary and details lists', () => {
		const { rerender } = render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={['A1: R1.', 'A2: R2.', 'A3: R3.', 'A4: R4.', 'A5: R5.']}
				scrollThreshold={5}
			/>
		);
		const summaryListNoScroll = screen.getByTestId(
			'runtime-disabled-summary-list'
		);
		expect(summaryListNoScroll).not.toHaveClass('max-h-44');
		expect(
			screen.queryByTestId('runtime-disabled-summary-scroll-hint')
		).not.toBeInTheDocument();

		rerender(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'A1: R1.',
					'A2: R2.',
					'A3: R3.',
					'A4: R4.',
					'A5: R5.',
					'A6: R6.',
				]}
				scrollThreshold={5}
			/>
		);
		const summaryListWithScroll = screen.getByTestId(
			'runtime-disabled-summary-list'
		);
		expect(summaryListWithScroll).toHaveClass('max-h-44');
		expect(
			screen.getByTestId('runtime-disabled-summary-scroll-hint')
		).toHaveTextContent('Scroll to view all reasons');

		rerender(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Action 1: Operation is in progress.',
					'Action 2: Operation is in progress.',
					'Action 3: Operation is in progress.',
					'Action 4: Operation is in progress.',
					'Action 5: Operation is in progress.',
				]}
				showRawToggle
				scrollThreshold={5}
				rawListTitle="Per-action details"
				toggleShowRawLabel="Show detailed list"
				toggleHideRawLabel="Hide detailed list"
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: /Show detailed list/ }));
		const detailsListNoScroll = screen.getByTestId(
			'runtime-disabled-details-list'
		);
		expect(detailsListNoScroll).not.toHaveClass('max-h-44');
		expect(
			screen.queryByTestId('runtime-disabled-details-scroll-hint')
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('runtime-disabled-details-sticky-subheader')
		).not.toBeInTheDocument();

		rerender(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Action 1: Operation is in progress.',
					'Action 2: Operation is in progress.',
					'Action 3: Operation is in progress.',
					'Action 4: Operation is in progress.',
					'Action 5: Operation is in progress.',
					'Action 6: Operation is in progress.',
				]}
				showRawToggle
				scrollThreshold={5}
				rawListTitle="Per-action details"
				toggleShowRawLabel="Show detailed list"
				toggleHideRawLabel="Hide detailed list"
			/>
		);
		const showDetailsButton = screen.queryByRole('button', {
			name: /Show detailed list/,
		});
		if (showDetailsButton) {
			fireEvent.click(showDetailsButton);
		}
		const detailsListWithScroll = screen.getByTestId(
			'runtime-disabled-details-list'
		);
		expect(detailsListWithScroll).toHaveClass('max-h-44');
		expect(
			screen.getByTestId('runtime-disabled-details-scroll-hint')
		).toHaveTextContent('Scroll to view all details');
		expect(
			screen.getByTestId('runtime-disabled-details-sticky-subheader')
		).toHaveTextContent('Per-action details');
	});

	it('enables scrolling classes for long summary and details lists', () => {
		const { rerender } = render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={['A1: R1.', 'A2: R2.', 'A3: R3.', 'A4: R4.', 'A5: R5.']}
				overflowFadeStrength="strong"
			/>
		);
		const summaryList = screen.getByTestId('runtime-disabled-summary-list');
		expect(summaryList).toHaveClass('max-h-44');
		expect(summaryList).toHaveClass('overflow-y-auto');
		expect(summaryList).toHaveAttribute('tabindex', '0');
		expect(
			screen.getByTestId('runtime-disabled-summary-scroll-hint')
		).toHaveTextContent('Scroll to view all reasons');
		const summaryOverflowTop = screen.getByTestId(
			'runtime-disabled-summary-overflow-top'
		);
		const summaryOverflowBottom = screen.getByTestId(
			'runtime-disabled-summary-overflow-bottom'
		);
		const summaryFadeTop = screen.getByTestId(
			'runtime-disabled-summary-fade-top'
		);
		const summaryFadeBottom = screen.getByTestId(
			'runtime-disabled-summary-fade-bottom'
		);
		expect(summaryFadeTop).toHaveClass('h-6');
		expect(summaryFadeBottom).toHaveClass('h-6');
		expect(summaryOverflowTop).toHaveClass('opacity-0');
		expect(summaryOverflowBottom).not.toHaveClass('opacity-0');
		expect(summaryFadeTop).toHaveClass('opacity-0');
		expect(summaryFadeBottom).not.toHaveClass('opacity-0');
		Object.defineProperty(summaryList, 'scrollTop', {
			value: 8,
			writable: true,
			configurable: true,
		});
		fireEvent.scroll(summaryList);
		expect(summaryOverflowTop).not.toHaveClass('opacity-0');
		expect(summaryOverflowBottom).toHaveClass('opacity-0');
		expect(summaryFadeTop).not.toHaveClass('opacity-0');
		expect(summaryFadeBottom).toHaveClass('opacity-0');

		rerender(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={[
					'Action 1: Operation is in progress.',
					'Action 2: Operation is in progress.',
					'Action 3: Operation is in progress.',
					'Action 4: Operation is in progress.',
					'Action 5: Operation is in progress.',
				]}
				showRawToggle
				rawListTitle="Per-action details"
				toggleShowRawLabel="Show detailed list"
				toggleHideRawLabel="Hide detailed list"
				overflowFadeStrength="strong"
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Show detailed list/ }));
		const detailsList = screen.getByTestId('runtime-disabled-details-list');
		expect(detailsList).toHaveClass('max-h-44');
		expect(detailsList).toHaveClass('overflow-y-auto');
		expect(detailsList).toHaveAttribute('tabindex', '0');
		expect(
			screen.getByTestId('runtime-disabled-details-scroll-hint')
		).toHaveTextContent('Scroll to view all details');
		expect(
			screen.getByTestId('runtime-disabled-details-sticky-subheader')
		).toHaveTextContent('Rows 5');
		const stickySubheaderChip = screen.getByTestId(
			'runtime-disabled-details-sticky-subheader-chip'
		);
		expect(stickySubheaderChip).toHaveClass('shadow-none');
		const detailsOverflowTop = screen.getByTestId(
			'runtime-disabled-details-overflow-top'
		);
		const detailsOverflowBottom = screen.getByTestId(
			'runtime-disabled-details-overflow-bottom'
		);
		const detailsFadeTop = screen.getByTestId(
			'runtime-disabled-details-fade-top'
		);
		const detailsFadeBottom = screen.getByTestId(
			'runtime-disabled-details-fade-bottom'
		);
		expect(detailsFadeTop).toHaveClass('h-6');
		expect(detailsFadeBottom).toHaveClass('h-6');
		expect(detailsOverflowTop).toHaveClass('opacity-0');
		expect(detailsOverflowBottom).not.toHaveClass('opacity-0');
		expect(detailsFadeTop).toHaveClass('opacity-0');
		expect(detailsFadeBottom).not.toHaveClass('opacity-0');
		Object.defineProperty(detailsList, 'scrollTop', {
			value: 8,
			writable: true,
			configurable: true,
		});
		fireEvent.scroll(detailsList);
		expect(detailsOverflowTop).not.toHaveClass('opacity-0');
		expect(detailsOverflowBottom).toHaveClass('opacity-0');
		expect(detailsFadeTop).not.toHaveClass('opacity-0');
		expect(detailsFadeBottom).toHaveClass('opacity-0');
		expect(stickySubheaderChip).toHaveClass('shadow-sm');
	});

	it('wires aria-live announcements only when enabled', () => {
		const { rerender } = render(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={['Start site: Site already running.']}
				announceChanges
			/>
		);

		const liveRegion = document.querySelector('[aria-live="polite"]');
		expect(liveRegion).toBeTruthy();
		expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

		rerender(
			<RuntimeDisabledActionsHintCard
				title="Runtime reasons"
				hints={['Start site: Site already running.']}
				announceChanges={false}
			/>
		);

		expect(document.querySelector('[aria-live="polite"]')).toBeNull();
	});
});
