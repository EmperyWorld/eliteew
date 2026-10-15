/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor sticky-header meta labels: sentence-case, no shout.
 *
 * Related:
 * - chrome/HeaderMetricBadge.tsx
 * - chrome/UltimateDocEditorDocumentHeader.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOC_EDITOR_HEADER_META_LABEL_CLASS } from '../chrome/HeaderMetricBadge';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

/** Drop block/line comments so prose mentioning the ban does not trip class locks. */
function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Ultimate Doc Editor sticky header premium chrome', () => {
	it('keeps meta label token sentence-case (no uppercase shout)', () => {
		expect(DOC_EDITOR_HEADER_META_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(DOC_EDITOR_HEADER_META_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('HeaderMetricBadge uses shared meta label class (no raw uppercase class)', () => {
		const src = stripComments(readSrc('../chrome/HeaderMetricBadge.tsx'));
		expect(src).toContain('DOC_EDITOR_HEADER_META_LABEL_CLASS');
		expect(src).not.toMatch(/\buppercase\b/);
	});

	it('DocumentHeader section labels use shared meta class (no uppercase shout)', () => {
		const src = stripComments(
			readSrc('../chrome/UltimateDocEditorDocumentHeader.tsx')
		);
		expect(src).toContain('DOC_EDITOR_HEADER_META_LABEL_CLASS');
		expect(src).not.toMatch(/\buppercase\b/);
	});
});
