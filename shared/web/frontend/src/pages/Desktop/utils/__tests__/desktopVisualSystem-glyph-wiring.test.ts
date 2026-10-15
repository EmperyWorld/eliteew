/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: DesktopFolderSymbol must import shared renderDesktopAppMotif (atomization wiring).
 *
 * Invariants:
 * - Folder glyph must not call renderDesktopAppMotif as an unbound free identifier.
 *
 * Related:
 * - `desktopVisualSystem/renderDesktopAppMotif.tsx`
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderDesktopAppMotif } from '../desktopVisualSystem/renderDesktopAppMotif';
import { FOLDER_TILE_VISUAL } from '../desktopVisualSystem/appGlyphMap';

const here = dirname(fileURLToPath(import.meta.url));

describe('desktopVisualSystem glyph motif wiring', () => {
	it('exports renderDesktopAppMotif as a function', () => {
		expect(typeof renderDesktopAppMotif).toBe('function');
		const node = renderDesktopAppMotif(
			FOLDER_TILE_VISUAL.motif,
			FOLDER_TILE_VISUAL
		);
		expect(node).toBeTruthy();
	});

	it('DesktopFolderSymbol imports renderDesktopAppMotif from shared module', () => {
		const src = readFileSync(
			join(here, '../desktopVisualSystem/DesktopFolderSymbol.tsx'),
			'utf8'
		);
		expect(src).toMatch(
			/import\s*\{\s*renderDesktopAppMotif\s*\}\s*from\s*['"]\.\/renderDesktopAppMotif['"]/
		);
		expect(src).toContain('renderDesktopAppMotif(visual.motif, visual)');
	});

	it('DesktopAppSymbol imports renderDesktopAppMotif from shared module', () => {
		const src = readFileSync(
			join(here, '../desktopVisualSystem/DesktopAppSymbol.tsx'),
			'utf8'
		);
		expect(src).toMatch(
			/import\s*\{\s*renderDesktopAppMotif\s*\}\s*from\s*['"]\.\/renderDesktopAppMotif['"]/
		);
		expect(src).not.toMatch(/^function renderDesktopAppMotif\b/m);
	});
});
