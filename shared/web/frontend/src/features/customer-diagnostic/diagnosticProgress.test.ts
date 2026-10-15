import { describe, expect, it } from 'vitest';

import {
	computeDiagnosticProgressPercent,
	getBlockingPreviousModule,
	getModuleAnswerProgress,
	isModuleComplete,
	isModuleUnlocked,
} from './diagnosticProgress';
import type { CustomerDiagnosticSessionState } from './diagnosticTypes';
import { defaultCustomerDiagnosticState } from './diagnosticTypes';

function fillArchetype(
	state: CustomerDiagnosticSessionState
): CustomerDiagnosticSessionState {
	const answers: Record<string, number> = {};
	for (let i = 1; i <= 24; i++) answers[String(i)] = 3;
	return {
		...state,
		answers: { ...state.answers, archetype: answers },
	};
}

describe('diagnosticProgress', () => {
	it('computeDiagnosticProgressPercent returns 0 for empty state', () => {
		const s = defaultCustomerDiagnosticState();
		expect(computeDiagnosticProgressPercent(s)).toBe(0);
	});

	it('isModuleComplete archetype when24 answers', () => {
		const s = fillArchetype(defaultCustomerDiagnosticState());
		expect(isModuleComplete('archetype', s)).toBe(true);
	});

	it('progress increases when archetype completed', () => {
		const empty = defaultCustomerDiagnosticState();
		const full = fillArchetype(empty);
		expect(computeDiagnosticProgressPercent(full)).toBeGreaterThan(
			computeDiagnosticProgressPercent(empty)
		);
	});

	it('getModuleAnswerProgress archetype full is 100%', () => {
		const s = fillArchetype(defaultCustomerDiagnosticState());
		const p = getModuleAnswerProgress('archetype', s);
		expect(p.percent).toBe(100);
		expect(p.answered).toBe(24);
	});

	it('sequential unlock: values blocked until archetype complete', () => {
		const empty = defaultCustomerDiagnosticState();
		expect(isModuleUnlocked('archetype', empty)).toBe(true);
		expect(isModuleUnlocked('values', empty)).toBe(false);
		expect(getBlockingPreviousModule('values', empty)).toBe('archetype');
	});

	it('sequential unlock: values opens after archetype done', () => {
		const s = fillArchetype(defaultCustomerDiagnosticState());
		expect(isModuleComplete('archetype', s)).toBe(true);
		expect(isModuleUnlocked('values', s)).toBe(true);
		expect(getBlockingPreviousModule('values', s)).toBe(null);
	});
});
