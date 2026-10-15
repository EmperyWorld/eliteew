/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock welcome tour product name and action-oriented copy: «Тур по приложению»,
 * not «познакомься со столом».
 *
 * Invariants:
 * - RU badge/nudge/menuLabel stay «Тур по приложению».
 * - EN sync-status body still scopes durability to the browser (P13).
 *
 * Related:
 * - i18n/locales/{ru,en}/desktopChrome.json
 * - documentation/product/desktop/ONBOARDING-AND-HOTKEYS.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../..'
);

type WelcomeChrome = {
	welcomeOnboarding: {
		title: string;
		guide: {
			badge: string;
			menuLabel: string;
			steps: Record<
				string,
				{ title: string; body: string; demoCaption?: string }
			>;
			examples: { workspaceTitle: string };
		};
		nudge: { title: string; body: string; cta: string };
	};
};

function readChrome(locale: 'ru' | 'en'): WelcomeChrome {
	return JSON.parse(
		readFileSync(
			join(frontendRoot, `src/i18n/locales/${locale}/desktopChrome.json`),
			'utf8'
		)
	) as WelcomeChrome;
}

describe('welcome onboarding copy', () => {
	it('names the first-visit tour «Тур по приложению» in RU', () => {
		const ru = readChrome('ru').welcomeOnboarding;
		expect(ru.title).toBe('Тур по приложению');
		expect(ru.guide.badge).toBe('Тур по приложению');
		expect(ru.guide.menuLabel).toBe('Тур по приложению');
		expect(ru.nudge.title).toBe('Тур по приложению');
		expect(ru.nudge.cta).toBe('Начать тур');
		const blob = JSON.stringify(ru);
		expect(blob).not.toMatch(/Познаком/i);
		expect(blob).not.toContain('Знакомство со столом');
		expect(ru.guide.steps.intro.body).toMatch(/куда нажать/i);
		expect(ru.guide.steps.start.body).toMatch(/Пуск/i);
		expect(ru.guide.steps.outro.body).toContain('Тур по приложению');
		expect(ru.guide.steps['widgets-panel'].demoCaption).toMatch(/Пример/i);
		expect(ru.guide.examples.workspaceTitle).toMatch(/Правый клик/i);
	});

	it('names the first-visit tour App tour in EN and keeps browser save scope', () => {
		const en = readChrome('en').welcomeOnboarding;
		expect(en.title).toBe('App tour');
		expect(en.guide.badge).toBe('App tour');
		expect(en.guide.menuLabel).toBe('App tour');
		expect(en.nudge.title).toBe('App tour');
		expect(en.nudge.title.toLowerCase()).not.toContain('get to know');
		expect(en.guide.steps['sync-status'].body.toLowerCase()).toContain(
			'browser'
		);
		expect(en.guide.steps.intro.body.toLowerCase()).toMatch(/where to click/);
	});
});
