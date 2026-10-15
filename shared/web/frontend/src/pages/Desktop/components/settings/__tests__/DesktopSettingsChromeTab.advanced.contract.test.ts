/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 2 Lock — Chrome tab keeps opacity/scale behind shared disclosure.
 * Wave 6 Lock — style preset grids sit behind looks disclosures; preview primary.
 *
 * Related:
 * - ../DesktopSettingsChromeTab.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopSettingsChromeTab progressive disclosure', () => {
	const readSrc = () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		return readFileSync(join(dir, '../DesktopSettingsChromeTab.tsx'), 'utf8');
	};

	it('keeps window/taskbar primary and opacity/scale behind chrome-advanced', () => {
		const src = readSrc();
		const windowIdx = src.indexOf("desktop_window_style'");
		const taskbarIdx = src.indexOf("desktop_taskbar_style'");
		const advancedIdx = src.indexOf(
			'data-testid="desktop-settings-chrome-advanced"'
		);
		const opacityIdx = src.indexOf("desktop_panel_opacity'");
		const scaleIdx = src.indexOf("desktop_ui_scale'");

		expect(windowIdx).toBeGreaterThan(-1);
		expect(taskbarIdx).toBeGreaterThan(-1);
		expect(advancedIdx).toBeGreaterThan(-1);
		expect(windowIdx).toBeLessThan(advancedIdx);
		expect(taskbarIdx).toBeLessThan(advancedIdx);
		expect(opacityIdx).toBeGreaterThan(advancedIdx);
		expect(scaleIdx).toBeGreaterThan(advancedIdx);
		expect(src).toContain('DesktopSettingsPersonalizeDisclosure');
		expect(src).toContain('settingsPanel.chromeAdvancedTitle');
	});

	it('Wave 6: style grids are behind looks disclosures (preview stays primary)', () => {
		const src = readSrc();
		const previewFrame = src.indexOf(
			'DESKTOP_WINDOW_FRAME_STYLES[desktopWindowStyle].frame'
		);
		const windowLooks = src.indexOf(
			'data-testid="desktop-settings-chrome-window-looks"'
		);
		const taskbarStrip = src.indexOf('<DesktopTaskbarPreviewStrip');
		const taskbarLooks = src.indexOf(
			'data-testid="desktop-settings-chrome-taskbar-looks"'
		);
		expect(previewFrame).toBeGreaterThan(-1);
		expect(windowLooks).toBeGreaterThan(previewFrame);
		expect(taskbarStrip).toBeGreaterThan(-1);
		expect(taskbarLooks).toBeGreaterThan(taskbarStrip);
		expect(src).toContain('settingsPanel.chromeWindowLooksChangeTitle');
		expect(src).toContain('settingsPanel.chromeTaskbarLooksChangeTitle');
	});
});
