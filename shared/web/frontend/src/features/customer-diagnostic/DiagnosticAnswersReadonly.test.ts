import { describe, expect, it } from 'vitest';

import { QUESTIONS } from './diagnosticDefinition';

describe('DiagnosticAnswersReadonly helpers', () => {
	it('archetype question catalog matches answer keys used in UI', () => {
		expect(QUESTIONS.archetype.length).toBeGreaterThan(0);
		expect(QUESTIONS.archetype[0]?.options?.length).toBeGreaterThan(0);
	});
});
