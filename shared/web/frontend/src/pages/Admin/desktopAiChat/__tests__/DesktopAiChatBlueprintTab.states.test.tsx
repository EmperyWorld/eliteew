/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAiChatBlueprintTab states contract', () => {
	it('loads blueprint tab through provider and workbench shell', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const tabSrc = readFileSync(
			join(dir, '../DesktopAiChatBlueprintTab.tsx'),
			'utf8'
		);
		expect(tabSrc).toContain('DesktopAiChatBlueprintProvider');
		expect(tabSrc).toContain('EnsemblePlanWorkbench');
		expect(tabSrc).toContain("loadState === 'loading'");
		expect(tabSrc).toContain('aria-busy="true"');
	});

	it('workbench uses focus trap, assertive errors, and responsive layout', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const workbench = readFileSync(
			join(dir, '../EnsemblePlanWorkbench.tsx'),
			'utf8'
		);
		expect(workbench).toContain('useDesktopAiDialogFocusTrap');
		expect(workbench).toContain('desktopAiChatBlueprintApi');
		expect(workbench).toContain('overflow-x-auto');
		expect(workbench).toContain('min-w-[640px]');
		expect(workbench).toContain('h-[100dvh]');
		expect(workbench).toContain('aria-busy');
		expect(workbench).toContain('sm:grid-cols-2');
	});

	it('form editor drag handles expose aria labels', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const steps = readFileSync(
			join(
				dir,
				'../../ensemblePlan/ensemblePlanForm/EnsemblePlanStepsSection.tsx'
			),
			'utf8'
		);
		const chrome = readFileSync(
			join(
				dir,
				'../../ensemblePlan/ensemblePlanForm/EnsemblePlanFormChrome.tsx'
			),
			'utf8'
		);
		expect(steps).toContain('adminEnsemblePlan.editor.dragStepAria');
		expect(steps).toContain('moveUpAria');
		expect(steps).toContain('moveDownAria');
		expect(chrome).toContain('aria-live="assertive"');
	});
});
