/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWA opening preloader phase builder.
 */

import { describe, expect, it } from 'vitest';

import {
	buildEwaOpeningPhases,
	EWA_OPENING_DAUGHTER_PERSONA_IDS,
	phaseDurationMs,
} from '@/features/ewa/ewaOpeningPreloaderSequence';

describe('ewaOpeningPreloaderSequence', () => {
	it('builds full daughter parade plus veiled arlika and parent finale', () => {
		const phases = buildEwaOpeningPhases(false);
		expect(phases[0]).toEqual({ kind: 'persona', personaId: 'mela' });
		expect(phases.at(-1)).toEqual({ kind: 'parent_finale' });
		expect(phases.some((p) => p.kind === 'arlika_veil')).toBe(true);
		expect(
			phases.filter((p) => p.kind === 'persona').map((p) => p.personaId)
		).toEqual([...EWA_OPENING_DAUGHTER_PERSONA_IDS]);
	});

	it('reduced motion skips to parent finale only', () => {
		expect(buildEwaOpeningPhases(true)).toEqual([{ kind: 'parent_finale' }]);
	});

	it('parent finale is shorter under reduced motion', () => {
		expect(phaseDurationMs({ kind: 'parent_finale' }, true)).toBeLessThan(
			phaseDurationMs({ kind: 'parent_finale' }, false)
		);
	});
});
