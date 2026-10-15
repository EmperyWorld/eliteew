/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard command palette i18n defs against orphan or fake-open calendar stubs,
 * and lock P12/P20: no Apps Open catalog keys in code or locale JSON.
 *
 * Related:
 * - src/pages/Desktop/components/commandPalette/useCommandPaletteModel.tsx
 * - src/i18n/locales/en/desktopUi.json
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../..'
);

type CalendarCommandDefs = {
	name: string;
	description: string;
	infoHint: string;
	searchHints: string;
};

type TimeCommandDefs = {
	name: string;
	description: string;
	infoHint: string;
};

function readDesktopUiCommandPalette(locale: 'en' | 'ru') {
	const raw = readFileSync(
		join(frontendRoot, `src/i18n/locales/${locale}/desktopUi.json`),
		'utf8'
	);
	const parsed = JSON.parse(raw) as {
		commandPalette: {
			groupApps?: string;
			openApp?: string;
			groupActions?: string;
			commandDefs: Record<
				string,
				CalendarCommandDefs | { description: string }
			>;
		};
	};
	return parsed.commandPalette;
}

function readDesktopUiCommandDefs(locale: 'en' | 'ru') {
	return readDesktopUiCommandPalette(locale).commandDefs;
}

describe('CommandPalette command defs contract', () => {
	it('registers calendar as read-only info (not a fake open action)', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../commandPalette/useCommandPaletteModel.tsx'),
			'utf8'
		);
		expect(src).toContain("id: 'calendar'");
		expect(src).toContain('commandPalette.commandDefs.calendar.name');
		expect(src).toContain('commandPalette.commandDefs.calendar.infoHint');
		expect(src).toContain('commandPalette.commandDefs.calendar.searchHints');
		expect(src).toContain('commandPalette.commandDefs.time.infoHint');
		expect(src).not.toContain('commandPalette.commandDefs.date');
		expect(src).not.toContain("onAction?.('calendar')");
	});

	it('does not build an Apps Open catalog from desktop items (P12)', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const model = readFileSync(
			join(dir, '../commandPalette/useCommandPaletteModel.tsx'),
			'utf8'
		);
		const groups = readFileSync(
			join(dir, '../commandPalette/CommandPaletteGroups.tsx'),
			'utf8'
		);
		expect(model).not.toContain("groupKind: 'apps'");
		expect(model).not.toContain('commandPalette.groupApps');
		expect(model).not.toContain('commandPalette.openApp');
		expect(model).not.toContain('items.filter');
		expect(groups).toContain('commandPalette.groupActions');
	});

	it('purges orphan Apps Open i18n keys from en/ru (P20)', () => {
		for (const locale of ['en', 'ru'] as const) {
			const palette = readDesktopUiCommandPalette(locale);
			expect(palette.groupApps).toBeUndefined();
			expect(palette.openApp).toBeUndefined();
			expect(palette.groupActions).toBeTruthy();
		}
	});

	it('keeps calendar i18n honest in en and ru', () => {
		const enExpectedName = "Today's date";
		const ruExpectedName = 'Сегодняшняя дата';

		for (const [locale, expectedName] of [
			['en', enExpectedName],
			['ru', ruExpectedName],
		] as const) {
			const defs = readDesktopUiCommandDefs(locale);
			expect(defs.calendar).toBeDefined();
			expect(defs.date).toBeUndefined();
			const calendar = defs.calendar as CalendarCommandDefs;
			expect(calendar.name).toBe(expectedName);
			expect(calendar.infoHint.length).toBeGreaterThan(0);
			expect(calendar.searchHints.length).toBeGreaterThan(0);
			expect(calendar.description.toLowerCase()).not.toMatch(
				/\bopen\b.*\bcalendar\b/
			);
			expect(calendar.description.toLowerCase()).not.toMatch(
				/открыть.*календар/
			);
			expect(calendar.name.toLowerCase()).not.toBe('calendar');
			expect(calendar.name.toLowerCase()).not.toBe('календарь');
			expect(calendar.infoHint.toLowerCase()).not.toMatch(
				/\bopen\b.*\bcalendar\b/
			);
			expect(calendar.infoHint.toLowerCase()).not.toMatch(/открыть.*календар/);

			expect(defs.time).toBeDefined();
			const time = defs.time as TimeCommandDefs;
			expect(time.infoHint.length).toBeGreaterThan(0);
		}
	});
});
