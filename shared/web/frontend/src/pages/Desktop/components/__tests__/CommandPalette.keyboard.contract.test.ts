/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for Command Palette Home/End list navigation.
 *
 * Related:
 * - src/pages/Desktop/components/CommandPalette.tsx
 * - src/pages/Desktop/components/commandPalette/useCommandPaletteKeyboard.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readPaletteSources() {
	const dir = dirname(fileURLToPath(import.meta.url));
	const parent = readFileSync(join(dir, '../CommandPalette.tsx'), 'utf8');
	const keyboard = readFileSync(
		join(dir, '../commandPalette/useCommandPaletteKeyboard.ts'),
		'utf8'
	);
	const groups = readFileSync(
		join(dir, '../commandPalette/CommandPaletteGroups.tsx'),
		'utf8'
	);
	const model = readFileSync(
		join(dir, '../commandPalette/useCommandPaletteModel.tsx'),
		'utf8'
	);
	return { parent, keyboard, groups, model };
}

describe('CommandPalette keyboard contract', () => {
	it('supports Home/End on cmdk items', () => {
		const { keyboard } = readPaletteSources();
		expect(keyboard).toContain("e.key === 'Home' || e.key === 'End'");
		expect(keyboard).toContain(
			"el.querySelectorAll<HTMLElement>('[cmdk-item]')"
		);
	});

	it('supports ArrowDown/ArrowUp from cmdk search input', () => {
		const { keyboard } = readPaletteSources();
		expect(keyboard).toContain("e.key === 'ArrowDown' || e.key === 'ArrowUp'");
		expect(keyboard).toContain("active?.matches('[cmdk-input]')");
	});

	it('clears search on Escape before closing palette', () => {
		const { parent } = readPaletteSources();
		expect(parent).toContain('searchEscapeValue={search}');
		expect(parent).toContain('onSearchEscapeClear');
		expect(parent).not.toContain('onEscapeLayer');
	});

	it('opts out of ModalAdvanced trapFocus and implements its own Tab cycle', () => {
		const { parent, keyboard } = readPaletteSources();
		expect(parent).toContain('trapFocus={false}');
		expect(parent).toContain('handleContainerKeyDown');
		expect(keyboard).toContain("e.key !== 'Tab'");
		expect(keyboard).toContain(
			'input, button, a[href], [tabindex]:not([tabindex="-1"])'
		);
		expect(parent).toContain('data-desktop-shell-keyboard-surface');
	});

	it('sources palette shortcut badges from i18n registry', () => {
		const { model } = readPaletteSources();
		expect(model).toContain('getCommandPaletteShortcutLabel');
		expect(model).toContain('formatShortcutKeysForPlatform');
		expect(model).not.toContain("shortcut: 'Ctrl+Shift+N'");
		expect(model).not.toContain("shortcut: 'Win+D'");
	});

	it('keeps info rows read-only without closing palette', () => {
		const { groups } = readPaletteSources();
		expect(groups).toContain('data-info-row="true"');
		expect(groups).toContain('aria-disabled');
		expect(groups).toContain('info-only — keep palette open');
		expect(groups).not.toMatch(
			/quickActions\.map[\s\S]*runAction\(cmd\.action\)/
		);
	});
});
