/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ordered persona phases for the EWA app opening preloader (no text labels).
 *
 * Invariants:
 * - Daughters appear one-by-one; both Arlika modes share one veiled beat; parent (`parent`) closes the sequence.
 *
 * Related:
 * - src/features/ewa/EwaOpeningPreloader.tsx
 * - src/features/ewa/ewaPersonaCatalog.ts
 */
import type { EwaPersonaId } from '@/features/ewa/ewaPersonaCatalog';

export type EwaOpeningPhase =
	| { kind: 'persona'; personaId: EwaPersonaId }
	| { kind: 'arlika_veil' }
	| { kind: 'parent_finale' };

/** Daughter personas in display order (parent excluded until finale). */
export const EWA_OPENING_DAUGHTER_PERSONA_IDS: readonly EwaPersonaId[] = [
	'mela',
	'zera',
	'kora',
	'tala',
	'feni',
] as const;

export function buildEwaOpeningPhases(
	reducedMotion: boolean
): readonly EwaOpeningPhase[] {
	if (reducedMotion) {
		return [{ kind: 'parent_finale' }];
	}
	return [
		...EWA_OPENING_DAUGHTER_PERSONA_IDS.map(
			(personaId) => ({ kind: 'persona', personaId }) as const
		),
		{ kind: 'arlika_veil' },
		{ kind: 'parent_finale' },
	];
}

export const EWA_OPENING_PHASE_MS = {
	persona: 560,
	arlika_veil: 920,
	parent_finale: 1280,
	parent_finale_reduced: 720,
} as const;

export function phaseDurationMs(
	phase: EwaOpeningPhase,
	reducedMotion: boolean
): number {
	if (phase.kind === 'persona') {
		return EWA_OPENING_PHASE_MS.persona;
	}
	if (phase.kind === 'arlika_veil') {
		return EWA_OPENING_PHASE_MS.arlika_veil;
	}
	return reducedMotion
		? EWA_OPENING_PHASE_MS.parent_finale_reduced
		: EWA_OPENING_PHASE_MS.parent_finale;
}
