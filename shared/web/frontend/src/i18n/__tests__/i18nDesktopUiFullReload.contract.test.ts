/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for the Desktop route locale boundary after cold chrome seed.
 *
 * Invariants:
 * - `i18nReady` does not load full desktopUi.
 * - `ensureDesktopUiReady` loads full copy once before Desktop mounts.
 *
 * Related:
 * - `i18n/config.ts`, `i18n/lazyLocaleBackend.ts`
 */

import { beforeAll, describe, expect, it } from 'vitest';
import i18n, { ensureDesktopUiReady, i18nReady } from '../config';
import ruChrome from '../locales/ru/desktopChrome.json';

describe('i18n desktopUi full reload after chrome seed', () => {
	beforeAll(async () => {
		await i18nReady;
		await i18n.changeLanguage('ru');
	}, 30_000);

	it('seeds idle-critical keys from desktopChrome before full locale finishes', () => {
		expect(ruChrome.loginFallback?.heading).toBeTruthy();
		expect(ruChrome.titleBarChrome?.guideTour).toBeTruthy();
		expect(ruChrome.floatingWidgetCtx?.performanceModeBalanced).toBeTruthy();
	});

	it('keeps non-cold Desktop copy out of initial i18n readiness', () => {
		expect(i18n.t('calendarApp.title', { ns: 'desktopUi' })).toBe(
			'calendarApp.title'
		);
	});

	it('resolves full and seeded keys after the Desktop route boundary', async () => {
		await ensureDesktopUiReady();
		const heading = i18n.t('loginFallback.heading', { ns: 'desktopUi' });
		const guide = i18n.t('titleBarChrome.guideTour', { ns: 'desktopUi' });
		const perf = i18n.t('floatingWidgetCtx.performanceModeBalanced', {
			ns: 'desktopUi',
		});
		const calendarTitle = i18n.t('calendarApp.title', { ns: 'desktopUi' });

		expect(heading).not.toBe('loginFallback.heading');
		expect(heading.length).toBeGreaterThan(0);
		expect(guide).not.toBe('titleBarChrome.guideTour');
		expect(guide.length).toBeGreaterThan(0);
		expect(perf).not.toBe('floatingWidgetCtx.performanceModeBalanced');
		expect(perf.length).toBeGreaterThan(0);
		expect(calendarTitle).toBe('Календарь');
	});
});
