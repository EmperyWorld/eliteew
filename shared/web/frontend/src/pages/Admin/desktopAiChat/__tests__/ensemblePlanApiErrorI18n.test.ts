/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	extractApiErrorDetail,
	translateEnsemblePlanApiDetail,
} from '../../ensemblePlan/ensemblePlanApiErrorI18n';

describe('ensemblePlanApiErrorI18n', () => {
	const t = ((key: string, params?: Record<string, string>) => {
		if (params) {
			return `${key}:${JSON.stringify(params)}`;
		}
		return key;
	}) as never;

	it('formats pydantic-style validation arrays', () => {
		const detail = [
			{ loc: ['body', 'steps'], msg: 'field required', type: 'missing' },
		];
		const out = translateEnsemblePlanApiDetail(detail, t, 'fallback');
		expect(out.message).toContain('adminEnsemblePlan.apiValidation.fieldError');
		expect(out.rawJson).toContain('field required');
	});

	it('passes through string detail', () => {
		const out = translateEnsemblePlanApiDetail('slug taken', t, 'fallback');
		expect(out.message).toBe('slug taken');
		expect(out.rawJson).toBeNull();
	});

	it('extracts axios-like detail', () => {
		const err = { response: { data: { detail: 'forbidden' } } };
		expect(extractApiErrorDetail(err)).toBe('forbidden');
	});
});
