/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarMiniMonthGrid } from '../CalendarMiniMonthGrid';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { date?: string }) =>
			key === 'dayWithEventsAria' ? `${opts?.date ?? ''} — events` : key,
	}),
}));

describe('CalendarMiniMonthGrid', () => {
	const today = new Date('2026-08-19T12:00:00');
	const viewMonth = new Date('2026-08-01T12:00:00');

	it('shows an indicator dot on days with events', () => {
		const { container } = render(
			<CalendarMiniMonthGrid
				viewMonth={viewMonth}
				selectedDay={today}
				today={today}
				locale="ru-RU"
				events={[
					{
						id: 'evt-1',
						title: 'Meeting',
						notes: '',
						starts_at: '2026-08-19T09:00:00.000Z',
						ends_at: '2026-08-19T10:00:00.000Z',
						all_day: false,
						created_at: '2026-08-19T09:00:00.000Z',
						updated_at: '2026-08-19T09:00:00.000Z',
					},
				]}
				onViewMonthChange={() => {}}
				onSelectDay={() => {}}
			/>
		);

		const dayButtons = screen.getAllByRole('button');
		const day19 = dayButtons.find((button) =>
			button.textContent?.includes('19')
		);
		expect(day19).toBeDefined();
		expect(
			day19?.querySelector(
				'span.rounded-full.bg-\\[rgb\\(var\\(--desktop-accent-rgb\\)\\)\\]'
			)
		).not.toBeNull();
		expect(
			container.querySelectorAll('span.rounded-full').length
		).toBeGreaterThan(0);
	});
});
