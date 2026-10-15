/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	surveyDatetimeLocalValueToIso,
	surveyIsoToDatetimeLocalValue,
} from '../surveyAdminDateTimeUtils';
import { duplicateSurveyTitle } from '../surveyAdminDuplicateDraft';

describe('surveyAdminDateTimeUtils', () => {
	it('round-trips datetime-local value to ISO', () => {
		const iso = surveyDatetimeLocalValueToIso('2026-07-15T18:30');
		expect(iso).toBeTruthy();
		expect(surveyIsoToDatetimeLocalValue(iso)).toMatch(/^2026-07-15T\d{2}:30$/);
	});

	it('maps empty local value to null ISO', () => {
		expect(surveyDatetimeLocalValueToIso('')).toBeNull();
		expect(surveyDatetimeLocalValueToIso('   ')).toBeNull();
	});
});

describe('duplicateSurveyTitle', () => {
	it('appends suffix to non-empty title', () => {
		expect(duplicateSurveyTitle('Pulse', '(copy)')).toBe('Pulse (copy)');
	});

	it('falls back when title is blank', () => {
		expect(duplicateSurveyTitle('   ', '(copy)')).toBe('Survey (copy)');
	});
});
