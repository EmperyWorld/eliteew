import { describe, expect, it } from 'vitest';

import {
	buildStackedChartRows,
	buildTypeBreakdownRows,
	formatSuccessRatePercent,
	parseErrorDistribution,
	resolveUgsTypeLabel,
} from '../ugsAnalyticsData';

describe('ugsAnalyticsData', () => {
	it('builds breakdown rows with catalog labels and success rate', () => {
		const labels = new Map([['text_chat', 'Text Chat']]);
		const rows = buildTypeBreakdownRows(
			[
				{ type_key: 'text_chat', successful: 8, failed: 2 },
				{ type_key: 'unknown_type', successful: 0, failed: 0, total: 0 },
			],
			labels
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.label).toBe('Text Chat');
		expect(rows[0]?.total).toBe(10);
		expect(rows[0]?.successRate).toBeCloseTo(0.8);
	});

	it('humanizes missing catalog labels', () => {
		expect(resolveUgsTypeLabel('music_generator_v2', new Map())).toBe(
			'Music generator v2'
		);
	});

	it('limits stacked chart rows', () => {
		const base = buildTypeBreakdownRows(
			Array.from({ length: 20 }, (_, i) => ({
				type_key: `type_${i}`,
				successful: 1,
				failed: 0,
			})),
			new Map()
		);
		expect(buildStackedChartRows(base, 5)).toHaveLength(5);
	});

	it('formats success rate percent', () => {
		expect(formatSuccessRatePercent(0.876)).toBe('88%');
		expect(formatSuccessRatePercent(null)).toBe('—');
	});

	it('parses error distribution payloads', () => {
		expect(
			parseErrorDistribution([
				{ error_type: 'provider_error', count: 3 },
				{ error_type: '', count: 1 },
			])
		).toEqual([{ errorType: 'provider_error', count: 3 }]);
	});
});
