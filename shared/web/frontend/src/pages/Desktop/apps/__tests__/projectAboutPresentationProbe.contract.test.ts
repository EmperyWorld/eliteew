/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ProjectAbout presentation probe — reject SPA index fallback (matryoshka).
 *
 * Related:
 * - ProjectAboutApp.tsx
 * - fofline_spa_origin.rs (no SPA fallback for missing .html assets)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ProjectAbout presentation probe contract', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('source probes /o-proekte/index.html and rejects SPA root markers', () => {
		const src = readFileSync(join(__dirname, '../ProjectAboutApp.tsx'), 'utf8');
		expect(src).toContain("'/o-proekte/index.html'");
		expect(src).toContain('probePresentationReady');
		expect(src).toContain('eliteewfoflineclient');
		expect(src).toContain('id="root"');
		expect(src).toContain('presentationMissingTitle');
	});

	it('resolve mount does not double-wrap ProjectAbout chrome', () => {
		const resolveSrc = readFileSync(
			join(__dirname, '../../shell/appMounts.resolve.tsx'),
			'utf8'
		);
		const caseIdx = resolveSrc.indexOf("case 'ProjectAboutApp':");
		expect(caseIdx).toBeGreaterThan(-1);
		const endIdx = resolveSrc.indexOf(
			"case 'EmperyNexusChronicleApp':",
			caseIdx
		);
		const snippet = resolveSrc.slice(
			caseIdx,
			endIdx === -1 ? caseIdx + 160 : endIdx
		);
		expect(snippet).toMatch(/return ProjectAboutAppLazy/);
		expect(snippet).not.toMatch(/<\s*DesktopAppContentWrapper/);
	});
});
