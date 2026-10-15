/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub client-side ticket list filtering and sorting.
 */

import { describe, expect, it } from 'vitest';
import type { FeedbackTicket } from '../../services/productDesktopApi';
import {
	filterAndSortFeedbackTickets,
	ticketMatchesFeedbackSearchQuery,
} from '../feedbackHubTicketFilters';

function ticket(
	overrides: Partial<FeedbackTicket> & Pick<FeedbackTicket, 'id'>
): FeedbackTicket {
	return {
		kind: 'wish',
		body: 'Default body',
		status: 'open',
		admin_notes: null,
		reward_credits: null,
		closed_at: null,
		created_at: '2026-06-01T10:00:00.000Z',
		updated_at: '2026-06-01T10:00:00.000Z',
		...overrides,
	};
}

describe('filterAndSortFeedbackTickets', () => {
	const rows = [
		ticket({
			id: 'a',
			kind: 'wish',
			body: 'Add export',
			created_at: '2026-06-01T10:00:00.000Z',
		}),
		ticket({
			id: 'b',
			kind: 'bug',
			body: 'Crash on save',
			status: 'closed',
			created_at: '2026-06-02T10:00:00.000Z',
		}),
		ticket({
			id: 'c',
			kind: 'wish',
			body: 'Other',
			admin_notes: 'We will consider export',
			created_at: '2026-06-03T10:00:00.000Z',
		}),
	];

	it('filters by kind and status', () => {
		expect(
			filterAndSortFeedbackTickets(rows, {
				kindFilter: 'bug',
				statusFilter: 'all',
				query: '',
				newestFirst: true,
			}).map((r) => r.id)
		).toEqual(['b']);
		expect(
			filterAndSortFeedbackTickets(rows, {
				kindFilter: 'all',
				statusFilter: 'closed',
				query: '',
				newestFirst: true,
			}).map((r) => r.id)
		).toEqual(['b']);
	});

	it('searches body and team reply', () => {
		expect(
			filterAndSortFeedbackTickets(rows, {
				kindFilter: 'all',
				statusFilter: 'all',
				query: 'export',
				newestFirst: true,
			}).map((r) => r.id)
		).toEqual(['c', 'a']);
	});

	it('searches ticket id', () => {
		expect(
			filterAndSortFeedbackTickets(rows, {
				kindFilter: 'all',
				statusFilter: 'all',
				query: 'b',
				newestFirst: true,
			}).map((r) => r.id)
		).toEqual(['b']);
	});

	it('searches localized labels via haystack callback', () => {
		expect(
			filterAndSortFeedbackTickets(rows, {
				kindFilter: 'all',
				statusFilter: 'all',
				query: 'closed-label',
				newestFirst: true,
				searchHaystackForTicket: (row) =>
					row.id === 'b' ? ['closed-label'] : [],
			}).map((r) => r.id)
		).toEqual(['b']);
	});

	it('sorts oldest first with stable tie-break', () => {
		const tied = [
			ticket({ id: 'x', created_at: '2026-06-01T12:00:00.000Z' }),
			ticket({ id: 'y', created_at: '2026-06-01T12:00:00.000Z' }),
		];
		expect(
			filterAndSortFeedbackTickets(tied, {
				kindFilter: 'all',
				statusFilter: 'all',
				query: '',
				newestFirst: false,
			}).map((r) => r.id)
		).toEqual(['x', 'y']);
	});
});

describe('ticketMatchesFeedbackSearchQuery', () => {
	it('matches empty query', () => {
		expect(
			ticketMatchesFeedbackSearchQuery(ticket({ id: 'x' }), '', undefined)
		).toBe(true);
	});
});

describe('ticketMatchesFeedbackSearchQuery', () => {
	it('matches empty query', () => {
		expect(
			ticketMatchesFeedbackSearchQuery(ticket({ id: 'x' }), '', undefined)
		).toBe(true);
	});
});
