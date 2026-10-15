/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor File Manager chrome: sentence-case meta, no uppercase shout.
 *
 * Related:
 * - fileManagerChrome.ts, FileManagerPanel.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-FILE-MANAGER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS } from '../fileManagerChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Doc Editor File Manager premium chrome', () => {
	it('keeps sort / recent / all meta sentence-case (no uppercase shout)', () => {
		expect(DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS).not.toMatch(
			/\buppercase\b/
		);
		expect(DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('wires fileManagerChrome tokens into FileManagerPanel', () => {
		const src = stripComments(readSrc('../FileManagerPanel.tsx'));
		expect(src).toContain('DOC_EDITOR_FILE_MANAGER_SHELL_CLASS');
		expect(src).toContain('DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS');
		expect(src).not.toMatch(/\buppercase\b/);
	});
});
