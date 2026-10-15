/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: profile activity lazy module must not emit `/assets/ActivityLog-*.js`
 * (public edge returns 404 for that name while prod-core serves 200).
 *
 * Related:
 * - ../ProfileActivityPanel.tsx
 * - documentation/platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('profile activity lazy chunk name', () => {
	it('ProfileAccountMorePanel lazy-imports ProfileActivityPanel, not ActivityLog', () => {
		const source = readFileSync(
			join(here, '../ProfileAccountMorePanel.tsx'),
			'utf8'
		);
		expect(source).toMatch(/import\(['"]\.\/ProfileActivityPanel['"]\)/);
		expect(source).not.toMatch(/import\(['"]\.\/ActivityLog['"]\)/);
	});

	it('ProfileActivityPanel module file exists (Vite chunk stem)', () => {
		const panelPath = join(here, '../ProfileActivityPanel.tsx');
		const source = readFileSync(panelPath, 'utf8');
		expect(source).toContain('export default function ProfileActivityPanel');
		expect(panelPath.endsWith('ProfileActivityPanel.tsx')).toBe(true);
	});
});
