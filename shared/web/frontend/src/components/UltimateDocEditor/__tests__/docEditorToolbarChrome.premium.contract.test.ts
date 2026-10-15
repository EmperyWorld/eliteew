/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor sticky formatting toolbar premium chrome tokens.
 *
 * Related:
 * - EditorCore/docEditorToolbarChrome.ts
 * - chrome/UltimateDocEditorMainGrid.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS,
	DOC_EDITOR_TOOLBAR_STICKY_CLASS,
} from '../EditorCore/docEditorToolbarChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

describe('Ultimate Doc Editor sticky toolbar premium chrome', () => {
	it('keeps sticky strip as glass fade with soft blur', () => {
		expect(DOC_EDITOR_TOOLBAR_STICKY_CLASS).toMatch(/sticky top-0/);
		expect(DOC_EDITOR_TOOLBAR_STICKY_CLASS).toMatch(/backdrop-blur/);
		expect(DOC_EDITOR_TOOLBAR_STICKY_CLASS).toMatch(/bg-linear-to-b/);
		expect(DOC_EDITOR_TOOLBAR_STICKY_CLASS).toMatch(/inset_0_1px_0/);
	});

	it('keeps icon hover quiet (no opaque accent fill shout in base class)', () => {
		expect(DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS).toMatch(
			/hover:bg-\[color-mix/
		);
		expect(DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS).not.toMatch(
			/hover:bg-\(--desktop-surface-accent\)/
		);
		expect(DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS).not.toMatch(
			/shadow-\[0_1px_4px/
		);
	});

	it('MainGrid wires sticky token; IconButton has no translate bounce', () => {
		const grid = readSrc('../chrome/UltimateDocEditorMainGrid.tsx');
		expect(grid).toContain('DOC_EDITOR_TOOLBAR_STICKY_CLASS');
		expect(grid).toContain('data-doc-guide="editor-toolbar-sticky"');

		const btn = readSrc('../EditorCore/EditorToolbarIconButton.tsx');
		expect(btn).toContain('DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS');
		expect(btn).not.toMatch(/y:\s*-1/);
		expect(btn).toMatch(/scale:\s*1\.03/);
	});
});
