/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Start Menu Home surface: sentence-case section labels, soft hint strip
 * when content exists, and a single catalog CTA on fully empty Home/search.
 *
 * Invariants:
 * - HOME_SECTION_LABEL_CLASS includes normal-case (no uppercase shout).
 * - Empty Home/search: catalog CTA inside DesktopAppEmptyState; hint strip gated.
 * - Populated Home: hint strip + start-menu-home-all-apps remain present.
 *
 * Related:
 * - ../StartMenuHomeSurface.tsx
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md §5.2
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('StartMenuHomeSurface premium home contract', () => {
	it('uses sentence-case section labels and gated hint/CTA strip', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../StartMenuHomeSurface.tsx'), 'utf8');
		expect(src).toContain('HOME_SECTION_LABEL_CLASS');
		expect(src).toContain('normal-case');
		expect(src).toContain('start-menu-home-all-apps');
		expect(src).toContain(
			'rounded-2xl border border-(--desktop-border-subtle)'
		);
		expect(src).toContain("t('startMenu.homeHint')");
		expect(src).toContain("t('startMenu.openAllApps')");
		expect(src).toContain('showHintStrip');
		expect(src).toContain('density="home-short"');
		expect(src).toContain('density="catalog"');
	});

	it('puts a single catalog CTA inside empty Home and empty search states', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../StartMenuHomeSurface.tsx'), 'utf8');
		expect(src).toContain('showHintStrip = !(idleEmpty || searchEmpty)');
		expect(src).toContain('catalogCta');
		const emptyHomeBlock = src.slice(
			src.indexOf('{idleEmpty ? ('),
			src.indexOf('{pinnedShort.length > 0 ? (')
		);
		expect(emptyHomeBlock).toContain('<DesktopAppEmptyState');
		expect(emptyHomeBlock).toContain('{catalogCta}');
		const searchEmptyBlock = src.slice(
			src.indexOf('searchEmpty ? ('),
			src.indexOf('data-testid="start-menu-home-search-results"')
		);
		expect(searchEmptyBlock).toContain('{catalogCta}');
	});

	it('keeps clarified home copy in locale packs', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const ru = JSON.parse(
			readFileSync(
				join(dir, '../../../../../i18n/locales/ru/desktopUi.json'),
				'utf8'
			)
		) as {
			workspace: { emptyDesc: string };
			startMenu: {
				homeHint: string;
				openAllApps: string;
				emptyHomeDescription: string;
				emptySearchDescription: string;
				commandConsole: { focusSearchCta: string };
			};
		};
		const en = JSON.parse(
			readFileSync(
				join(dir, '../../../../../i18n/locales/en/desktopUi.json'),
				'utf8'
			)
		) as {
			workspace: { emptyDesc: string };
			startMenu: {
				homeHint: string;
				openAllApps: string;
				emptyHomeDescription: string;
				emptySearchDescription: string;
				commandConsole: { focusSearchCta: string };
			};
		};

		expect(ru.startMenu.homeHint).toContain('поиске');
		expect(ru.startMenu.openAllApps).toBe('Каталог приложений');
		expect(ru.startMenu.emptySearchDescription).not.toBe('Нет совпадений.');
		expect(en.startMenu.openAllApps).toBe('App catalog');
		expect(en.startMenu.emptySearchDescription).not.toBe('No matches.');
		expect(en.workspace.emptyDesc.toLowerCase()).toContain('app store');
		expect(en.workspace.emptyDesc.toLowerCase()).not.toContain('right-click');
		expect(ru.workspace.emptyDesc.toLowerCase()).toContain('магазин');
		expect(ru.workspace.emptyDesc).not.toMatch(/правая кнопка|контекстн/i);
		expect(en.startMenu.emptyHomeDescription.toLowerCase()).toContain(
			'catalog'
		);
		expect(en.startMenu.commandConsole.focusSearchCta.length).toBeGreaterThan(
			0
		);
		expect(ru.startMenu.commandConsole.focusSearchCta.length).toBeGreaterThan(
			0
		);
	});
});
