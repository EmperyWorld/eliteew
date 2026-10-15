/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for PresentationEditPage Waves 1–5 module extraction.
 *
 * Related:
 * - presentations/PresentationEditPage.tsx
 * - presentations/presentationEdit/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('PresentationEditPage atomization contract (Waves 1–5)', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const presentationsDir = join(testDir, '../..');
	const parentPath = join(presentationsDir, 'PresentationEditPage.tsx');
	const editDir = join(presentationsDir, 'presentationEdit');

	it('keeps export on parent path and wires presentationEdit modules', () => {
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(src).toContain('export const PresentationEditPage');
		expect(src).toContain(
			"from './presentationEdit/usePresentationEditorCompose'"
		);
		expect(src).toContain("from './presentationEdit/PresentationEditHeader'");
		expect(src).toContain(
			"from './presentationEdit/PresentationEditBasicInfoCard'"
		);
		expect(src).toContain(
			"from './presentationEdit/PresentationEditSlidePreview'"
		);
		expect(src).toContain(
			"from './presentationEdit/PresentationEditSlidesSidebar'"
		);
		expect(src).toContain(
			"from './presentationEdit/PresentationEditStatisticsPanel'"
		);
		expect(src).toContain(
			"from './presentationEdit/PresentationEditPublishingPanel'"
		);
		expect(src).toContain("from './presentationEdit/PresentationEditModals'");
		expect(src).not.toContain(
			"from './presentationEdit/PresentationEditColorSchemePreviewButton'"
		);
		expect(src).not.toMatch(/function assignDomCssVars\(/);
		expect(src).not.toMatch(/const defaultSlide:/);
		expect(src).not.toMatch(/const ollentiPresentationTemplate:/);
		expect(src).not.toMatch(/withPresentationTemplateContactI18n\(/);
		expect(lineCount).toBeLessThanOrEqual(800);
	});

	it('extracted Wave 1–5 modules exist and stay under 800 LOC each', () => {
		const modules = [
			'presentationDomCssVars.ts',
			'presentationEditorPresets.ts',
			'ollentiPresentationTemplates.ts',
			'presentationEditorStats.ts',
			'PresentationEditColorSchemePreviewButton.tsx',
			'PresentationEditSlideListThumbnail.tsx',
			'PresentationEditSlideEditorChrome.tsx',
			'PresentationEditSlideSettingsBasicTab.tsx',
			'PresentationEditSlideSettingsTypographyTab.tsx',
			'PresentationEditSlideSettingsColorsTab.tsx',
			'PresentationEditSlideSettingsImageTab.tsx',
			'PresentationEditHeader.tsx',
			'PresentationEditBasicInfoCard.tsx',
			'PresentationEditSlidePreview.tsx',
			'PresentationEditSlidesSidebar.tsx',
			'PresentationEditStatisticsPanel.tsx',
			'PresentationEditPublishingPanel.tsx',
			'PresentationEditModals.tsx',
			'usePresentationEditorDraft.ts',
			'usePresentationEditorHistory.ts',
			'usePresentationEditorAutoSave.ts',
			'usePresentationEditorKeyboard.ts',
			'usePresentationEditorSave.ts',
			'useOllentiTemplateBootstrap.ts',
			'usePresentationEditorCompose.ts',
		];

		for (const mod of modules) {
			const modPath = join(editDir, mod);
			const content = readFileSync(modPath, 'utf8');
			const lines = content.split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
			if (mod === 'useOllentiTemplateBootstrap.ts') {
				expect(content).toContain(
					'export function buildOllentiTemplateBootstrap'
				);
				expect(content).toContain(
					'export function useOllentiTemplateBootstrap'
				);
			}
			if (mod === 'usePresentationEditorCompose.ts') {
				expect(content).toContain(
					'export function usePresentationEditorCompose'
				);
			}
		}
	});
});
