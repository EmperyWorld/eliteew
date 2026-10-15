/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CalendarApp window contract: product copy, day selection, datetime popover.
 *
 * Related:
 * - ../CalendarApp.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarApp } from '../../CalendarApp';

vi.mock('../../../hooks/useDesktopCalendarEvents', () => ({
	useDesktopCalendarEvents: () => ({
		events: [],
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
		createEvent: vi.fn(),
		updateEvent: vi.fn(),
		deleteEvent: vi.fn(),
		isSaving: false,
		saveError: null,
	}),
}));

describe('CalendarApp contract', () => {
	it('renders a live calendar workspace with a new-event action', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<CalendarApp />
			</QueryClientProvider>
		);
		expect(
			screen.getByRole('table', {
				name: /calendar days|дни календаря|gridLabel/i,
			})
		).toBeTruthy();
		expect(
			screen.getAllByRole('button', {
				name: /new event|новое событие|newEvent/i,
			}).length
		).toBeGreaterThan(0);
		expect(document.body.textContent).not.toMatch(/Scaffold stub/i);
	});

	it('updates the selected-day hero when a grid day is clicked', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<CalendarApp />
			</QueryClientProvider>
		);
		const dayButtons = screen.getAllByRole('button', { pressed: false });
		const day15 = dayButtons.find((button) =>
			button.textContent?.includes('15')
		);
		if (!day15) {
			throw new Error('expected day 15 cell in grid');
		}
		fireEvent.click(day15);
		expect(screen.getByRole('button', { pressed: true })).toBeTruthy();
	});

	it('opens the datetime popover from the editor field trigger', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<CalendarApp />
			</QueryClientProvider>
		);
		const newEventButtons = screen.getAllByRole('button', {
			name: /new event|новое событие|newEvent/i,
		});
		expect(newEventButtons.length).toBeGreaterThan(0);
		fireEvent.click(newEventButtons[0] as HTMLButtonElement);
		const startsTrigger = screen.getByRole('button', {
			name: /starts|начало|fieldStarts/i,
		});
		fireEvent.click(startsTrigger);
		expect(
			screen.getByRole('dialog', {
				name: /pick date and time|выбор даты и времени|pickDateTime/i,
			})
		).toBeTruthy();
	});
});
