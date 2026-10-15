/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Desktop AI Chat ensemble roster min/max product contract (UI + mirror of API caps).
 *
 * Invariants:
 * - Create-picker defaults to min roster; resolve helper never exceeds max.
 *
 * Related:
 * - desktopAiHeroes.ts
 * - api/services/desktop_chat_ensemble/settings.py
 */
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_AI_HEROES,
	DESKTOP_ENSEMBLE_MAX_ROSTER,
	DESKTOP_ENSEMBLE_MIN_ROSTER,
	desktopEnsembleRosterHeroes,
} from '../desktopAiHeroes';

describe('desktop ensemble roster cap', () => {
	it('keeps product min/max aligned with server contract', () => {
		expect(DESKTOP_ENSEMBLE_MIN_ROSTER).toBe(3);
		expect(DESKTOP_ENSEMBLE_MAX_ROSTER).toBe(6);
		expect(DESKTOP_AI_HEROES.length).toBeGreaterThanOrEqual(
			DESKTOP_ENSEMBLE_MAX_ROSTER
		);
	});

	it('caps resolved roster at max even when settings list is longer', () => {
		const firstId = DESKTOP_AI_HEROES[0]?.id;
		expect(firstId).toBeTruthy();
		if (!firstId) {
			throw new Error('expected at least one desktop AI hero id');
		}
		const oversized = DESKTOP_AI_HEROES.map((h) => h.id).concat(firstId);
		const roster = desktopEnsembleRosterHeroes({
			desktop_chat_mode: 'ensemble',
			desktop_ensemble_ids: oversized,
		});
		expect(roster).toHaveLength(DESKTOP_ENSEMBLE_MAX_ROSTER);
		expect(roster.map((h) => h.id)).toEqual(
			DESKTOP_AI_HEROES.slice(0, DESKTOP_ENSEMBLE_MAX_ROSTER).map((h) => h.id)
		);
	});

	it('caps desktop_ensemble_all fallback at max', () => {
		const roster = desktopEnsembleRosterHeroes({
			desktop_chat_mode: 'ensemble',
			desktop_ensemble_all: true,
		});
		expect(roster).toHaveLength(DESKTOP_ENSEMBLE_MAX_ROSTER);
	});
});
