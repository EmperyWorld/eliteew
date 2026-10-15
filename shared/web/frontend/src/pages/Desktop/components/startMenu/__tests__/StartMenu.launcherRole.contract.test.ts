/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 1 Lock — Start Menu wires launcher role strip and role copy matches
 * `desktopLauncherRoles` (catalog/pins, not Quick Search / Palette jobs).
 *
 * Related:
 * - ../StartMenuSearchHeader.tsx
 * - ../../../utils/desktopLauncherRoles.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../../..'
);

describe('StartMenu launcher role contract (Wave 1 Lock)', () => {
	it('StartMenuSearchHeader wires roleTitle/Description/Badge', () => {
		const src = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../StartMenuSearchHeader.tsx'
			),
			'utf8'
		);
		expect(src).toContain('start-menu-launcher-role');
		expect(src).toContain("t('startMenu.roleTitle')");
		expect(src).toContain("t('startMenu.roleDescription')");
		expect(src).toContain("t('startMenu.roleBadge')");
	});

	it('role copy differentiates Start from Quick Search and Palette jobs', () => {
		const en = JSON.parse(
			readFileSync(
				join(frontendRoot, 'src/i18n/locales/en/desktopUi.json'),
				'utf8'
			)
		) as {
			startMenu: {
				roleTitle: string;
				roleDescription: string;
			};
			commandPalette: {
				commandDefs: { quickSearch: { description: string } };
			};
		};
		const chrome = JSON.parse(
			readFileSync(
				join(frontendRoot, 'src/i18n/locales/en/desktopChrome.json'),
				'utf8'
			)
		) as {
			quickSearch: { roleDescription: string };
		};

		const startDesc = en.startMenu.roleDescription.toLowerCase();
		expect(startDesc).toMatch(/app|pin|catalog|workspace/);
		expect(startDesc).not.toMatch(/power action|shell command/);
		expect(chrome.quickSearch.roleDescription.toLowerCase()).toMatch(
			/recent|file|find/
		);
		expect(chrome.quickSearch.roleDescription.toLowerCase()).toMatch(
			/not the full start catalog|not the full catalog/
		);
		expect(
			en.commandPalette.commandDefs.quickSearch.description.toLowerCase()
		).toMatch(/quick search|find recent/);
		expect(
			en.commandPalette.commandDefs.quickSearch.description.toLowerCase()
		).not.toBe('apps, recent files, and actions');
	});
});
