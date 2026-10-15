/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify buffered-range rendering behavior in TrackProgressBar.
 *
 * Invariants:
 * - Invalid ranges are filtered; valid ranges render as background segments.
 *
 * Related:
 * - src/components/Audio/TrackProgressBar.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TrackProgressBar } from '@/components/Audio/TrackProgressBar';

describe('TrackProgressBar buffered ranges', () => {
	it('renders buffered segments for valid ranges', () => {
		render(
			<TrackProgressBar
				currentTime={20}
				duration={100}
				bufferedRanges={[
					{ start: 0, end: 50 },
					{ start: 60, end: 80 },
					{ start: 90, end: 90 }, // invalid
				]}
				markers={[
					{ time: 15, label: 'Intro' },
					{ time: 75, label: 'Drop' },
				]}
			/>
		);
		expect(screen.getAllByTestId('track-progress-buffered-range')).toHaveLength(
			2
		);
		expect(screen.getAllByTestId('track-progress-marker')).toHaveLength(2);
	});

	it('clamps hover timestamp bubble near progress bar edges', () => {
		render(
			<TrackProgressBar currentTime={20} duration={100} onSeek={() => {}} />
		);
		const bar = screen.getByTestId('track-progress-bar-inner');
		Object.defineProperty(bar, 'getBoundingClientRect', {
			value: () =>
				({
					left: 0,
					top: 0,
					right: 100,
					bottom: 10,
					width: 100,
					height: 10,
					x: 0,
					y: 0,
					toJSON: () => ({}),
				}) as DOMRect,
		});
		fireEvent.mouseMove(bar, { clientX: 0 });
		const leftTooltip = screen.getAllByText('0:00').at(-1);
		expect(leftTooltip).toBeTruthy();
		expect(leftTooltip).toHaveStyle({ left: '6%' });
		fireEvent.mouseMove(bar, { clientX: 100 });
		const rightTooltip = screen.getAllByText('1:40').at(-1);
		expect(rightTooltip).toBeTruthy();
		expect(rightTooltip).toHaveStyle({ left: '94%' });
	});
});
