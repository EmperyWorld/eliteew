import { describe, expect, it } from 'vitest';

import { scoreArchetype } from './diagnosticScoring';

describe('scoreArchetype', () => {
	it('returns dominant archetype for uniform answers', () => {
		const answers: Record<string, number> = {};
		for (let i = 1; i <= 24; i++) answers[String(i)] = 3;
		const r = scoreArchetype(answers);
		expect(r).not.toBeNull();
		expect(r?.dominant.percentage).toBeGreaterThan(0);
		expect(r?.secondary.percentage).toBeGreaterThanOrEqual(0);
	});

	it('returns null without answers', () => {
		expect(scoreArchetype({})).toBeNull();
		expect(scoreArchetype(undefined)).toBeNull();
	});
});
