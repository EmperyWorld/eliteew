import { describe, expect, it } from 'vitest';

import { buildDiagnosticSessionSaveParts } from './diagnosticSessionAutosave';
import { defaultCustomerDiagnosticState } from './diagnosticTypes';

describe('buildDiagnosticSessionSaveParts', () => {
	it('returns same signature for identical draft and prevCompleted', () => {
		const d = defaultCustomerDiagnosticState();
		d.uiPhase = 'hub';
		d.answers = { archetype: { hero: 0.5 } };
		const prev = new Set<string>();
		const a = buildDiagnosticSessionSaveParts(d, prev);
		const b = buildDiagnosticSessionSaveParts(d, prev);
		expect(a.signature).toBe(b.signature);
	});

	it('changes signature when answers change', () => {
		const d1 = defaultCustomerDiagnosticState();
		d1.uiPhase = 'hub';
		d1.answers = { archetype: { hero: 0.1 } };
		const d2 = defaultCustomerDiagnosticState();
		d2.uiPhase = 'hub';
		d2.answers = { archetype: { hero: 0.9 } };
		const prev = new Set<string>();
		const s1 = buildDiagnosticSessionSaveParts(d1, prev).signature;
		const s2 = buildDiagnosticSessionSaveParts(d2, prev).signature;
		expect(s1).not.toBe(s2);
	});
});
