import { describe, expect, it } from 'vitest';
import {
	presenceSupersededReason,
	shouldRetrySocketAfterPresenceSuperseded,
} from '../presenceSupersededReason';

describe('presenceSupersededReason', () => {
	it('reads reason from payload', () => {
		expect(
			presenceSupersededReason({
				reason: 'single_browser_realtime',
				kept_sid: 'abc',
			})
		).toBe('single_browser_realtime');
	});

	it('returns empty for invalid payload', () => {
		expect(presenceSupersededReason(null)).toBe('');
		expect(presenceSupersededReason({ kept_sid: 'abc' })).toBe('');
	});
});

describe('shouldRetrySocketAfterPresenceSuperseded', () => {
	it('retries only for browser lease busy', () => {
		expect(
			shouldRetrySocketAfterPresenceSuperseded({
				reason: 'single_browser_realtime',
			})
		).toBe(true);
		expect(
			shouldRetrySocketAfterPresenceSuperseded({ reason: 'admin_kick' })
		).toBe(false);
	});
});
