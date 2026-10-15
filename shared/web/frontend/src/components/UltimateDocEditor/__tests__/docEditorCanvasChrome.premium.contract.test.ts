/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor reading canvas premium chrome (pad/shell/paper/focus).
 *
 * Related:
 * - chrome/docEditorCanvasChrome.ts, utils/tiptapProseThemeClass.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DOC_EDITOR_CANVAS_SHELL_CLASS,
	DOC_EDITOR_PROSE_FOCUS_CLASS,
	DOC_EDITOR_TIPTAP_WRAPPER_CLASS,
} from '../chrome/docEditorCanvasChrome';
import { getTiptapEditorRootClassName } from '../utils/tiptapProseThemeClass';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

describe('Ultimate Doc Editor reading canvas premium chrome', () => {
	it('keeps outer shell soft (inset sheen, not heavy drop shadow)', () => {
		expect(DOC_EDITOR_CANVAS_SHELL_CLASS).toMatch(/inset_0_1px_0/);
		expect(DOC_EDITOR_CANVAS_SHELL_CLASS).toMatch(/color-mix/);
		expect(DOC_EDITOR_CANVAS_SHELL_CLASS).not.toMatch(
			/shadow-\[var\(--desktop-shadow-soft\)\]/
		);
	});

	it('keeps TipTap paper wrapper without default panel drop shadow', () => {
		expect(DOC_EDITOR_TIPTAP_WRAPPER_CLASS).toContain('tiptap-editor-wrapper');
		expect(DOC_EDITOR_TIPTAP_WRAPPER_CLASS).toMatch(/shadow-\[inset_0_1px_0/);
		expect(DOC_EDITOR_TIPTAP_WRAPPER_CLASS).not.toMatch(
			/shadow-\[var\(--desktop-shadow-soft\)\]/
		);
		expect(DOC_EDITOR_TIPTAP_WRAPPER_CLASS).toMatch(/color-mix/);
	});

	it('uses soft prose focus ring on light and dark themes', () => {
		expect(DOC_EDITOR_PROSE_FOCUS_CLASS).toMatch(/focus-visible:ring-1/);
		expect(DOC_EDITOR_PROSE_FOCUS_CLASS).not.toMatch(/focus-visible:ring-2/);
		expect(getTiptapEditorRootClassName('light')).toContain(
			DOC_EDITOR_PROSE_FOCUS_CLASS
		);
		expect(getTiptapEditorRootClassName('dark')).toMatch(/leading-relaxed/);
		expect(getTiptapEditorRootClassName('dark')).toContain(
			DOC_EDITOR_PROSE_FOCUS_CLASS
		);
	});

	it('MainGrid and TiptapEditorInner wire canvas tokens', () => {
		const grid = readSrc('../chrome/UltimateDocEditorMainGrid.tsx');
		expect(grid).toContain('DOC_EDITOR_CANVAS_SHELL_CLASS');
		expect(grid).toContain('DOC_EDITOR_CANVAS_PAD_CLASS');

		const inner = readSrc('../EditorCore/TiptapEditorInner.tsx');
		expect(inner).toContain('DOC_EDITOR_TIPTAP_WRAPPER_CLASS');
	});
});
