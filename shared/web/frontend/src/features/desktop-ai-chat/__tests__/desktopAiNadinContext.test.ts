/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FE catalog wiring for Desktop AI Chat hero nadin_context.
 *
 * Invariants:
 * - Hero appears in assistants cohort with expected label and avatar path.
 *
 * Related:
 * - desktopAiHeroes.ts
 * - documentation/product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_AI_ASSISTANT_HEROES,
	DESKTOP_AI_HEROES,
	desktopEnsembleBubbleTintHex,
	getDesktopAiHero,
} from '../desktopAiHeroes';

describe('nadin_context hero catalog', () => {
	it('is in assistants cohort with dossier fields', () => {
		const hero = getDesktopAiHero('nadin_context');
		expect(hero).toBeDefined();
		expect(hero?.shortLabel).toBe('Найдин');
		expect(hero?.label).toBe('Найдин | Контекст и Смыслы');
		expect(hero?.avatarPublicPath).toBe('/avatars/nadin_context.webp');
		expect(hero?.sileroVoice).toBe('eugene');
		expect(
			DESKTOP_AI_ASSISTANT_HEROES.some((h) => h.id === 'nadin_context')
		).toBe(true);
		expect(DESKTOP_AI_HEROES.some((h) => h.id === 'nadin_context')).toBe(true);
		expect(desktopEnsembleBubbleTintHex('nadin_context')).toBe('#E8F5E9');
	});
});
