import { describe, expect, it } from 'vitest';
import { funnelStageRowsToWritePayload } from '../funnelStageWritePayload';

describe('funnelStageRowsToWritePayload', () => {
	it('omits conversion_rate and maps counters', () => {
		const payload = funnelStageRowsToWritePayload([
			{ name: 'Visit', visitors: '100', conversions: '25' },
			{ name: '  ', visitors: '1', conversions: '1' },
		]);
		expect(payload).toEqual([
			{
				stage_name: 'Visit',
				stage_order: 0,
				visitors: 100,
				conversions: 25,
			},
		]);
		expect(payload[0]).not.toHaveProperty('conversion_rate');
	});
});
