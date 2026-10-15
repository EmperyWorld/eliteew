import { describe, expect, it } from 'vitest';
import {
	ewDeskHasNewsSinceLastVisit,
	ewDeskIsPostNewSinceVisit,
} from '../ewDeskVisitHint';

describe('ewDeskHasNewsSinceLastVisit', () => {
	it('returns false when latest is missing', () => {
		expect(
			ewDeskHasNewsSinceLastVisit({
				latestPublishedAt: null,
				lastSeenPublishedAt: '2026-05-01T10:00:00Z',
			})
		).toBe(false);
	});

	it('returns true when last seen is absent but latest exists', () => {
		expect(
			ewDeskHasNewsSinceLastVisit({
				latestPublishedAt: '2026-05-02T10:00:00Z',
				lastSeenPublishedAt: null,
			})
		).toBe(true);
	});

	it('returns true when latest is after last seen', () => {
		expect(
			ewDeskHasNewsSinceLastVisit({
				latestPublishedAt: '2026-05-03T12:00:00Z',
				lastSeenPublishedAt: '2026-05-03T10:00:00Z',
			})
		).toBe(true);
	});

	it('returns false when latest equals or precedes last seen', () => {
		expect(
			ewDeskHasNewsSinceLastVisit({
				latestPublishedAt: '2026-05-03T10:00:00Z',
				lastSeenPublishedAt: '2026-05-03T10:00:00Z',
			})
		).toBe(false);
		expect(
			ewDeskHasNewsSinceLastVisit({
				latestPublishedAt: '2026-05-02T10:00:00Z',
				lastSeenPublishedAt: '2026-05-03T10:00:00Z',
			})
		).toBe(false);
	});
});

describe('ewDeskIsPostNewSinceVisit', () => {
	it('returns false when post date is missing', () => {
		expect(
			ewDeskIsPostNewSinceVisit({
				postPublishedAt: null,
				lastSeenPublishedAt: '2026-05-01T10:00:00Z',
			})
		).toBe(false);
	});

	it('returns true when last seen is absent', () => {
		expect(
			ewDeskIsPostNewSinceVisit({
				postPublishedAt: '2026-05-02T10:00:00Z',
				lastSeenPublishedAt: null,
			})
		).toBe(true);
	});

	it('compares post published_at against last seen', () => {
		expect(
			ewDeskIsPostNewSinceVisit({
				postPublishedAt: '2026-05-03T12:00:00Z',
				lastSeenPublishedAt: '2026-05-03T10:00:00Z',
			})
		).toBe(true);
		expect(
			ewDeskIsPostNewSinceVisit({
				postPublishedAt: '2026-05-02T10:00:00Z',
				lastSeenPublishedAt: '2026-05-03T10:00:00Z',
			})
		).toBe(false);
	});
});
