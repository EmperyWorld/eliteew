import { describe, expect, it } from 'vitest';
import {
	buildPoemmaExperienceBalance,
	computeInBalance,
	resolvePoemmaExperienceStatusLabel,
} from '../poemmaExperience';

describe('poemmaExperience', () => {
	it('computes in balance when scores are within threshold', () => {
		expect(computeInBalance(80, 78, 5)).toBe(true);
		expect(
			resolvePoemmaExperienceStatusLabel(computeInBalance(80, 78, 5))
		).toBe('В балансе');
	});

	it('detects gap when difference exceeds threshold', () => {
		expect(computeInBalance(80, 50, 5)).toBe(false);
		expect(
			resolvePoemmaExperienceStatusLabel(computeInBalance(80, 50, 5))
		).toBe('Есть разрыв');
	});

	it('builds experience balance entity with inBalance flag', () => {
		const balance = buildPoemmaExperienceBalance({
			orgId: 'org-1',
			employeeScore: 80,
			clientScore: 78,
			thresholdPercent: 5,
		});
		expect(balance.inBalance).toBe(true);
		expect(balance.employeeScore).toBe(80);
		expect(balance.clientScore).toBe(78);
	});
});
