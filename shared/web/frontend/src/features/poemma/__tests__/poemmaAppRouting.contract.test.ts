/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock for Poemma shell route resolve and owner-only gate after Wave 26+ split.
 *
 * Invariants:
 * - Idea/promo/guide/strategy path templates resolve with params.
 * - Unknown paths fall back to home template.
 * - Owner-only pages deny non-owner sessions.
 *
 * Related:
 * - ../poemmaAppRouting.ts
 */
import { describe, expect, it } from 'vitest';
import {
	findPoemmaPage,
	resolvePoemmaRoute,
	routeAllowedForSession,
	type PoemmaSession,
} from '../poemmaAppRouting';

describe('poemmaAppRouting', () => {
	it('resolves idea, promo action, guide branch, and strategy utp', () => {
		expect(resolvePoemmaRoute('/ideas/abc?decision=go')).toMatchObject({
			template: '/ideas/:id',
			ideaId: 'abc',
			ideaDecision: 'go',
		});
		expect(resolvePoemmaRoute('/promo/actions/p1')).toMatchObject({
			template: '/promo/actions/:id',
			promotionId: 'p1',
		});
		expect(resolvePoemmaRoute('/guide?branch=retention')).toMatchObject({
			template: '/guide',
			guideBranch: 'retention',
		});
		expect(resolvePoemmaRoute('/strategy?view=utp').strategyView).toBe('utp');
		expect(resolvePoemmaRoute('/strategy#utp').strategyView).toBe('utp');
		expect(resolvePoemmaRoute('/nope').template).toBe('/');
	});

	it('gates owner-only pages for team session', () => {
		const owner: PoemmaSession = {
			role: 'owner',
			displayName: 'O',
			roleLabel: 'Собственник',
		};
		const team: PoemmaSession = {
			role: 'team',
			displayName: 'T',
			roleLabel: 'Команда',
		};
		const finance = findPoemmaPage('/finance');
		expect(routeAllowedForSession(finance, owner)).toBe(true);
		expect(routeAllowedForSession(finance, team)).toBe(false);
		expect(routeAllowedForSession(findPoemmaPage('/'), team)).toBe(true);
	});
});
