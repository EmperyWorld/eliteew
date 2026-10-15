import { describe, expect, it } from 'vitest';
import {
	EWRP_HISTORY_STALE_AFTER_MS,
	isEwrpHistoryRowStale,
} from './ewrpStatusPhaseIndicator';

describe('isEwrpHistoryRowStale', () => {
	const now = 1_700_000_000_000;

	it('is false for terminal statuses', () => {
		expect(
			isEwrpHistoryRowStale('completed', '2000-01-01T00:00:00.000Z', now)
		).toBe(false);
		expect(isEwrpHistoryRowStale('failed', null, now)).toBe(false);
	});

	it('is false when updated_at is fresh', () => {
		const recent = new Date(now - 60_000).toISOString();
		expect(isEwrpHistoryRowStale('generating_images', recent, now)).toBe(false);
	});

	it('is true when non-terminal and updated_at is older than threshold', () => {
		const old = new Date(
			now - EWRP_HISTORY_STALE_AFTER_MS - 60_000
		).toISOString();
		expect(isEwrpHistoryRowStale('queued', old, now)).toBe(true);
		expect(isEwrpHistoryRowStale('generating_content', old, now)).toBe(true);
	});

	it('is false when updated_at is missing (cannot infer staleness)', () => {
		expect(isEwrpHistoryRowStale('queued', null, now)).toBe(false);
		expect(isEwrpHistoryRowStale('queued', undefined, now)).toBe(false);
	});
});
