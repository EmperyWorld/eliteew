/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor left panel rail premium chrome tokens.
 *
 * Related:
 * - chrome/docEditorSidebarChrome.ts, EditorPanelSidebar.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DOC_EDITOR_SIDEBAR_COLUMN_CLASS,
	DOC_EDITOR_SIDEBAR_ICON_BUTTON_ACTIVE_CLASS,
	DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS,
} from '../chrome/docEditorSidebarChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

describe('Ultimate Doc Editor left panel rail premium chrome', () => {
	it('keeps 44px centered icon column', () => {
		expect(DOC_EDITOR_SIDEBAR_COLUMN_CLASS).toMatch(/w-\[44px\]/);
		expect(DOC_EDITOR_SIDEBAR_COLUMN_CLASS).toMatch(/items-center/);
	});

	it('uses short hairline section dividers (not full-width slabs)', () => {
		expect(DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS).toMatch(/w-5/);
		expect(DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS).not.toMatch(/w-full/);
	});

	it('keeps open-panel active as soft accent mix (not opaque accent slab)', () => {
		expect(DOC_EDITOR_SIDEBAR_ICON_BUTTON_ACTIVE_CLASS).toMatch(/color-mix/);
		expect(DOC_EDITOR_SIDEBAR_ICON_BUTTON_ACTIVE_CLASS).not.toMatch(
			/bg-\(--desktop-surface-accent\)/
		);
	});

	it('EditorPanelSidebar wires chrome tokens and guide selector', () => {
		const src = readSrc('../chrome/EditorPanelSidebar.tsx');
		expect(src).toContain('DOC_EDITOR_SIDEBAR_COLUMN_CLASS');
		expect(src).toContain('DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS');
		expect(src).toContain('data-doc-guide="editor-panel-rail"');
		expect(src).not.toMatch(/variant=\{panelOpen\[key\] \? 'accent'/);
		expect(src).not.toMatch(/variant=\{busy \? 'danger'/);
	});
});
