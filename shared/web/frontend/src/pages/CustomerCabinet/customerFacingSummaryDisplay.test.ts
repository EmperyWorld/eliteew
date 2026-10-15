import { describe, expect, it } from 'vitest';

import type { CustomerFacingSummaryRecord } from '@/pages/MarketingCabinet/marketingCabinetApi';

import {
	customerFacingSummaryResponseHasBody,
	parseCustomerFacingSummaryRecord,
} from './customerFacingSummaryDisplay';

describe('parseCustomerFacingSummaryRecord', () => {
	it('returns empty when record null', () => {
		const r = parseCustomerFacingSummaryRecord(null);
		expect(r.hasBody).toBe(false);
		expect(r.bullets).toEqual([]);
	});

	it('detects headline and metrics', () => {
		const rec: CustomerFacingSummaryRecord = {
			payload: {
				headline: '  Hi ',
				intro: '',
				bullets: [],
				metrics: [{ label: ' A ', value: ' 1 ' }],
			},
			updated_at: null,
			updated_by_user_id: null,
		};
		const r = parseCustomerFacingSummaryRecord(rec);
		expect(r.hasBody).toBe(true);
		expect(r.headline).toBe('Hi');
		expect(r.metrics).toEqual([{ label: 'A', value: '1' }]);
	});

	it('parses JSON string payload (legacy / double-encoded jsonb)', () => {
		const rec = {
			payload:
				'{"headline":"From string","intro":"","bullets":["a"],"metrics":[]}',
			updated_at: null,
			updated_by_user_id: null,
		} as unknown as CustomerFacingSummaryRecord;
		const r = parseCustomerFacingSummaryRecord(rec);
		expect(r.hasBody).toBe(true);
		expect(r.headline).toBe('From string');
		expect(r.bullets).toEqual(['a']);
	});
});

describe('customerFacingSummaryResponseHasBody', () => {
	it('returns false for null summary', () => {
		expect(customerFacingSummaryResponseHasBody({ summary: null })).toBe(false);
	});
});
