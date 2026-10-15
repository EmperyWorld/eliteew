/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Professional Worlds API error formatting helper.
 *
 * Invariants:
 * - Parse drift maps to i18n contract key, not raw Zod output.
 *
 * Related:
 * - professionalWorldsApiError.ts
 */

import { describe, expect, it } from 'vitest';

import {
	formatProfessionalWorldsApiError,
	formatProfessionalWorldsApiSupportDetail,
} from '../professionalWorldsApiError';
import { ProfessionalWorldsApiParseError } from '../professionalWorldsApiZod';

describe('formatProfessionalWorldsApiError', () => {
	const t = (key: string) => key;

	it('maps ProfessionalWorldsApiParseError to contract message key', () => {
		expect(
			formatProfessionalWorldsApiError(
				new ProfessionalWorldsApiParseError('Invalid deal response'),
				t
			)
		).toBe('realtorPro.errors.apiContract');
	});

	it('does not use Error.message as primary copy', () => {
		expect(formatProfessionalWorldsApiError(new Error('network down'), t)).toBe(
			'realtorPro.errors.unableToLoad'
		);
	});

	it('keeps Error.message available only as support detail', () => {
		expect(
			formatProfessionalWorldsApiSupportDetail(new Error('network down'))
		).toBe('network down');
	});

	it('falls back to unableToLoad for unknown errors', () => {
		expect(formatProfessionalWorldsApiError({}, t)).toBe(
			'realtorPro.errors.unableToLoad'
		);
	});

	it('uses explicit fallback when provided', () => {
		expect(formatProfessionalWorldsApiError({}, t, 'custom fallback')).toBe(
			'custom fallback'
		);
	});
});
