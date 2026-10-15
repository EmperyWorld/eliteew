import { describe, expect, it } from 'vitest';
import {
	ewrpJobSlideEnergyCredits,
	ewrpRetryButtonTitle,
	ewrpRetryEnergyCredits,
	ewrpRetryEnergyDetail,
} from './ewrpRetryPresentation';
import { EWRP_CREDITS_PER_SLIDE } from './EwrpGeneratorChunks';

const i18n = {
	retryTitleFailed: ({ total }: { total: number }) => `failed ${total}`,
	retryTitleStale: () => 'stale free',
	retryEnergyFree: () => '0 ⚡',
	retryEnergyBilled: ({ total }: { total: number }) => `${total} ⚡`,
};

describe('ewrpRetryEnergyCredits', () => {
	it('returns 0 for stale in-progress retry', () => {
		expect(ewrpRetryEnergyCredits('queued', 10)).toBe(0);
	});

	it('bills failed retry by slide count', () => {
		expect(ewrpRetryEnergyCredits('failed', 5)).toBe(
			5 * EWRP_CREDITS_PER_SLIDE
		);
	});
});

describe('ewrpJobSlideEnergyCredits', () => {
	it('matches duplicate/create billing scale', () => {
		expect(ewrpJobSlideEnergyCredits(5)).toBe(5 * EWRP_CREDITS_PER_SLIDE);
		expect(ewrpJobSlideEnergyCredits(0)).toBe(EWRP_CREDITS_PER_SLIDE);
	});

	it('uses server creditsPerSlide when provided', () => {
		expect(ewrpJobSlideEnergyCredits(5, 150)).toBe(750);
		expect(ewrpRetryEnergyCredits('failed', 4, 150)).toBe(600);
	});
});

describe('ewrpRetryPresentation labels', () => {
	it('shows free energy line for stale jobs', () => {
		expect(ewrpRetryEnergyDetail('generating_content', 8, i18n)).toBe('0 ⚡');
		expect(ewrpRetryButtonTitle('generating_content', 8, i18n)).toBe(
			'stale free'
		);
	});

	it('shows billed energy for failed jobs', () => {
		expect(ewrpRetryEnergyDetail('failed', 3, i18n)).toBe(
			`${3 * EWRP_CREDITS_PER_SLIDE} ⚡`
		);
		expect(ewrpRetryButtonTitle('failed', 3, i18n)).toBe(
			`failed ${3 * EWRP_CREDITS_PER_SLIDE}`
		);
	});
});
