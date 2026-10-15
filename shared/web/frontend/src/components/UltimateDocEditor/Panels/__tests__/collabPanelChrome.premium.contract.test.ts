/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Ultimate Doc Editor Collaboration panel chrome: sentence-case meta, no uppercase shout.
 *
 * Related:
 * - collabPanelChrome.ts, CollaborationPanel.tsx
 * - documentation/product/DOC-EDITOR-COLLABORATION.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOC_EDITOR_COLLAB_META_LABEL_CLASS } from '../collabPanelChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Doc Editor Collaboration panel premium chrome', () => {
	it('keeps participants / activity meta sentence-case (no uppercase shout)', () => {
		expect(DOC_EDITOR_COLLAB_META_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(DOC_EDITOR_COLLAB_META_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('wires collabPanelChrome tokens into CollaborationPanel', () => {
		const src = stripComments(readSrc('../CollaborationPanel.tsx'));
		expect(src).toContain('DOC_EDITOR_COLLAB_SHELL_CLASS');
		expect(src).toContain('DOC_EDITOR_COLLAB_META_LABEL_CLASS');
		expect(src).toContain('DOC_EDITOR_COLLAB_HEADER_CLASS');
		expect(src).not.toMatch(/\buppercase\b/);
		expect(src).not.toContain('❌');
	});
});
