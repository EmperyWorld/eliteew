import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	ensurePreloaderSessionStartedAt,
	getRemainingPreloaderMinMs,
	getConfiguredPreloaderMinMs,
} from '../appPreloader';

describe('appPreloader session budget', () => {
	let now = 0;

	beforeEach(() => {
		now = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		window.__ELITEEW_PRELOADER_STARTED_AT = 0;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete window.__ELITEEW_PRELOADER_STARTED_AT;
	});

	it('getRemainingPreloaderMinMs decreases with elapsed time', () => {
		const total = getConfiguredPreloaderMinMs();
		expect(getRemainingPreloaderMinMs()).toBe(total);
		now = total / 2;
		expect(getRemainingPreloaderMinMs()).toBe(Math.ceil(total / 2));
		now = total;
		expect(getRemainingPreloaderMinMs()).toBe(0);
	});

	it('ensurePreloaderSessionStartedAt is stable', () => {
		const first = ensurePreloaderSessionStartedAt();
		now = 500;
		expect(ensurePreloaderSessionStartedAt()).toBe(first);
	});
});
