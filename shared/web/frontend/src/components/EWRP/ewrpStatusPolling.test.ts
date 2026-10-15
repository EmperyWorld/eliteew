import { describe, expect, it } from 'vitest';
import {
	clampEwrpStatusProgress,
	ewrpPollStatusOutcome,
} from './ewrpStatusPolling';

describe('clampEwrpStatusProgress', () => {
	it('clamps to 0–100 and rounds', () => {
		expect(clampEwrpStatusProgress(45.6)).toBe(46);
		expect(clampEwrpStatusProgress(-5)).toBe(0);
		expect(clampEwrpStatusProgress(150)).toBe(100);
	});

	it('returns 0 for invalid input', () => {
		expect(clampEwrpStatusProgress(undefined)).toBe(0);
		expect(clampEwrpStatusProgress(Number.NaN)).toBe(0);
	});
});

describe('ewrpPollStatusOutcome', () => {
	it('detects terminal statuses', () => {
		expect(ewrpPollStatusOutcome('completed')).toBe('completed');
		expect(ewrpPollStatusOutcome('failed')).toBe('failed');
	});

	it('continues polling for in-progress statuses', () => {
		expect(ewrpPollStatusOutcome('queued')).toBe('continue');
		expect(ewrpPollStatusOutcome('generating_images')).toBe('continue');
	});
});
