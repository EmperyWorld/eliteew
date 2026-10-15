/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for tab-local survey runner sessionStorage persistence.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	clearSurveyRunnerIntroDismissed,
	clearSurveyRunnerSession,
	persistSurveyRunnerIntroDismissed,
	persistSurveyRunnerSession,
	readSurveyRunnerIntroDismissed,
	readSurveyRunnerSession,
} from '../surveyRunnerSession';

const SURVEY_ID = 'test-survey-session';

afterEach(() => {
	clearSurveyRunnerSession(SURVEY_ID);
	clearSurveyRunnerIntroDismissed(SURVEY_ID);
	sessionStorage.clear();
});

describe('surveyRunnerSession', () => {
	it('returns null when no session stored', () => {
		expect(readSurveyRunnerSession(SURVEY_ID)).toBeNull();
	});

	it('persists and reads runner payload', () => {
		persistSurveyRunnerSession(SURVEY_ID, {
			step: 2,
			review: false,
			answers: { q1: 'hello' },
		});
		const session = readSurveyRunnerSession(SURVEY_ID);
		expect(session?.step).toBe(2);
		expect(session?.review).toBe(false);
		expect(session?.answers).toEqual({ q1: 'hello' });
		expect(typeof session?.updatedAt).toBe('string');
	});

	it('clears session on demand', () => {
		persistSurveyRunnerSession(SURVEY_ID, {
			step: 0,
			review: false,
			answers: {},
		});
		clearSurveyRunnerSession(SURVEY_ID);
		expect(readSurveyRunnerSession(SURVEY_ID)).toBeNull();
	});

	it('ignores invalid JSON in sessionStorage', () => {
		sessionStorage.setItem(`eliteew-survey-runner:${SURVEY_ID}`, '{bad json');
		expect(readSurveyRunnerSession(SURVEY_ID)).toBeNull();
	});

	it('tracks intro dismissed flag separately', () => {
		expect(readSurveyRunnerIntroDismissed(SURVEY_ID)).toBe(false);
		persistSurveyRunnerIntroDismissed(SURVEY_ID);
		expect(readSurveyRunnerIntroDismissed(SURVEY_ID)).toBe(true);
		clearSurveyRunnerIntroDismissed(SURVEY_ID);
		expect(readSurveyRunnerIntroDismissed(SURVEY_ID)).toBe(false);
	});
});
