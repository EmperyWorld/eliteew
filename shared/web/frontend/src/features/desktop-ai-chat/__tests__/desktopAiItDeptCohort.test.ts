/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock IT department cohort catalog + picker section helpers for Desktop AI Chat.
 *
 * Invariants:
 * - Six `it_*` heroes; assistants default roster excludes IT.
 *
 * Related:
 * - desktopAiHeroes.ts, desktopAiItDeptHeroes.ts
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_AI_ASSISTANT_HEROES,
	DESKTOP_AI_HEROES,
	DESKTOP_ENSEMBLE_MAX_ROSTER,
	desktopAiHeroCohort,
	desktopAiHeroesByCohort,
	getDesktopAiHero,
} from '../desktopAiHeroes';
import { DESKTOP_AI_COLLECTIVE_SOULS_HEROES } from '../desktopAiCollectiveSoulsHeroes';
import {
	DESKTOP_AI_IT_DEPT_HEROES,
	DESKTOP_AI_IT_DEPT_HERO_IDS,
} from '../desktopAiItDeptHeroes';

describe('desktop AI IT department cohort', () => {
	it('exposes six IT heroes with cohort metadata', () => {
		expect(DESKTOP_AI_IT_DEPT_HERO_IDS).toHaveLength(6);
		expect(DESKTOP_AI_IT_DEPT_HEROES).toHaveLength(6);
		for (const h of DESKTOP_AI_IT_DEPT_HEROES) {
			expect(h.cohort).toBe('it_dept');
			expect(h.id.startsWith('it_')).toBe(true);
			expect(h.avatarPublicPath).toBe(`/avatars/${h.id}.webp`);
			expect(getDesktopAiHero(h.id)?.id).toBe(h.id);
		}
	});

	it('splits catalog into assistants, collective souls, and it_dept', () => {
		const assistants = desktopAiHeroesByCohort('assistants');
		const collectiveSouls = desktopAiHeroesByCohort('collective_souls');
		const itDept = desktopAiHeroesByCohort('it_dept');
		expect(assistants.length).toBe(DESKTOP_AI_ASSISTANT_HEROES.length);
		expect(collectiveSouls.length).toBe(
			DESKTOP_AI_COLLECTIVE_SOULS_HEROES.length
		);
		expect(itDept.length).toBe(6);
		expect(
			assistants.every((h) => desktopAiHeroCohort(h) === 'assistants')
		).toBe(true);
		expect(
			collectiveSouls.every(
				(h) => desktopAiHeroCohort(h) === 'collective_souls'
			)
		).toBe(true);
		expect(itDept.every((h) => desktopAiHeroCohort(h) === 'it_dept')).toBe(
			true
		);
		expect(DESKTOP_AI_HEROES.length).toBe(
			assistants.length + collectiveSouls.length + itDept.length
		);
	});

	it('keeps default assistant slice under ensemble max without IT', () => {
		const defaults = DESKTOP_AI_ASSISTANT_HEROES.slice(
			0,
			DESKTOP_ENSEMBLE_MAX_ROSTER
		);
		expect(defaults.every((h) => !h.id.startsWith('it_'))).toBe(true);
		expect(defaults.length).toBeLessThanOrEqual(DESKTOP_ENSEMBLE_MAX_ROSTER);
	});
});
