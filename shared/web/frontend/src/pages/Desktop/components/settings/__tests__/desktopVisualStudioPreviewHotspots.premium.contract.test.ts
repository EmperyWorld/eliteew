/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Visual Studio live-preview chips + stage chrome: sentence-case shell meta,
 * quiet stage/shell (no heavy drop shadow / accent wash), localized morph label.
 *
 * Invariants:
 * - `VISUAL_STUDIO_PREVIEW_CHIP_CLASS` has no `uppercase` / `sectionOverlineStrong`.
 * - Stage/shell have no `0_28px_64px` drop shadow or accent radial/hairline wash.
 * - Preview morph chip uses `previewIconLabel`, not English `App` hardcode.
 *
 * Related:
 * - ../desktopVisualStudioPreviewHotspots.ts
 * - ../DesktopVisualStudioPreview.tsx
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md §1.7
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
	VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS,
	VISUAL_STUDIO_PREVIEW_SHELL_CLASS,
	VISUAL_STUDIO_PREVIEW_STAGE_CLASS,
	visualStudioPreviewHotspotButtonClass,
} from '../desktopVisualStudioPreviewHotspots';

describe('Visual Studio preview premium chip contract', () => {
	it('keeps chip class sentence-case (no overline shout)', () => {
		expect(VISUAL_STUDIO_PREVIEW_CHIP_CLASS).not.toMatch(/\buppercase\b/);
		expect(VISUAL_STUDIO_PREVIEW_CHIP_CLASS).not.toContain(
			'sectionOverlineStrong'
		);
		expect(VISUAL_STUDIO_PREVIEW_CHIP_CLASS).toMatch(/tracking-normal/);
		expect(VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS).toContain('rounded-md');
		expect(VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS).not.toContain(
			'rounded-full'
		);
	});

	it('keeps stage and shell chrome quiet (no heavy shadow / accent wash)', () => {
		expect(VISUAL_STUDIO_PREVIEW_STAGE_CLASS).not.toMatch(/0_28px_64px/);
		expect(VISUAL_STUDIO_PREVIEW_STAGE_CLASS).toContain(
			'shadow-(--desktop-shadow-panel)'
		);
		expect(VISUAL_STUDIO_PREVIEW_SHELL_CLASS).not.toMatch(/desktop-accent-rgb/);
		expect(visualStudioPreviewHotspotButtonClass(true)).not.toMatch(/0_0_12px/);
	});

	it('wires chip class into preview, legend, and interactive surfaces', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const preview = readFileSync(
			join(dir, '../DesktopVisualStudioPreview.tsx'),
			'utf8'
		);
		const interactive = readFileSync(
			join(
				dir,
				'../desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive.tsx'
			),
			'utf8'
		);
		const section = readFileSync(
			join(dir, '../DesktopSettingsVisualStudioSection.tsx'),
			'utf8'
		);
		expect(preview).toContain('VISUAL_STUDIO_PREVIEW_STAGE_CLASS');
		expect(preview).toContain(
			"t('settingsPanel.visualStudio.previewIconLabel')"
		);
		expect(preview).not.toMatch(/["']App["']/);
		expect(interactive).toContain('VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS');
		expect(interactive).not.toContain('sectionOverlineStrong');
		expect(section).toContain('VISUAL_STUDIO_PREVIEW_SHELL_CLASS');
	});

	it('keeps RU/EN morph and legend labels sentence-case product copy', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const ru = JSON.parse(
			readFileSync(
				join(dir, '../../../../../i18n/locales/ru/desktopUi.json'),
				'utf8'
			)
		) as {
			settingsPanel: {
				visualStudio: {
					previewIconLabel: string;
					hotspotLegendWidget: string;
					livePreviewInteractiveHint: string;
				};
			};
		};
		const en = JSON.parse(
			readFileSync(
				join(dir, '../../../../../i18n/locales/en/desktopUi.json'),
				'utf8'
			)
		) as {
			settingsPanel: {
				visualStudio: {
					previewIconLabel: string;
					hotspotLegendWidget: string;
					livePreviewInteractiveHint: string;
				};
			};
		};
		expect(ru.settingsPanel.visualStudio.previewIconLabel).toBe('Приложение');
		expect(ru.settingsPanel.visualStudio.hotspotLegendWidget).toBe('Виджет');
		expect(
			ru.settingsPanel.visualStudio.livePreviewInteractiveHint.length
		).toBeGreaterThan(20);
		expect(
			en.settingsPanel.visualStudio.previewIconLabel.length
		).toBeGreaterThan(2);
		expect(en.settingsPanel.visualStudio.hotspotLegendWidget).not.toBe(
			'WIDGET'
		);
	});
});
