import { describe, expect, it } from 'vitest';
import {
	EWRP_CREDITS_PER_SLIDE,
	EWRP_HISTORY_STALE_AFTER_MS,
} from './EwrpGeneratorChunks';
import { buildEwrpHistoryRowEnergyLabels } from './ewrpHistoryRowEnergyLabels';

const i18n = {
	retryTitleFailed: ({ total }: { total: number }) => `retry-failed-${total}`,
	retryTitleStale: () => 'retry-stale',
	retryEnergyFree: () => '0 ⚡',
	retryEnergyBilled: ({ total }: { total: number }) => `${total} ⚡`,
	duplicateEnergyBilled: ({ total }: { total: number }) => `dup-${total} ⚡`,
	duplicateTitleWithEnergy: ({ total }: { total: number }) =>
		`dup-title-${total}`,
};

describe('buildEwrpHistoryRowEnergyLabels', () => {
	const now = Date.parse('2026-05-27T12:00:00.000Z');

	it('shows billed retry and duplicate for failed jobs', () => {
		const labels = buildEwrpHistoryRowEnergyLabels(
			{ status: 'failed', num_slides: 5, updated_at: null },
			i18n,
			now
		);
		expect(labels.showRetry).toBe(true);
		expect(labels.showDuplicate).toBe(true);
		expect(labels.retryEnergyLine).toBe(`${5 * EWRP_CREDITS_PER_SLIDE} ⚡`);
		expect(labels.duplicateEnergyLine).toBe(
			`dup-${5 * EWRP_CREDITS_PER_SLIDE} ⚡`
		);
	});

	it('shows free retry only for stale in-progress jobs', () => {
		const stale = new Date(
			now - EWRP_HISTORY_STALE_AFTER_MS - 1000
		).toISOString();
		const labels = buildEwrpHistoryRowEnergyLabels(
			{ status: 'queued', num_slides: 8, updated_at: stale },
			i18n,
			now
		);
		expect(labels.showRetry).toBe(true);
		expect(labels.showDuplicate).toBe(false);
		expect(labels.retryEnergyLine).toBe('0 ⚡');
		expect(labels.duplicateEnergyLine).toBeNull();
	});

	it('hides action labels for fresh in-progress jobs', () => {
		const recent = new Date(now - 60_000).toISOString();
		const labels = buildEwrpHistoryRowEnergyLabels(
			{ status: 'generating_images', num_slides: 5, updated_at: recent },
			i18n,
			now
		);
		expect(labels.showRetry).toBe(false);
		expect(labels.showDuplicate).toBe(false);
		expect(labels.retryTitle).toBeNull();
	});
});
