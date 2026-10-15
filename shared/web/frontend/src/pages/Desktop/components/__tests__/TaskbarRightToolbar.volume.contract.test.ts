/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Volume rail chip is icon-only; range lives in popover (not nested in rail button).
 *
 * Related:
 * - ../taskbarStrip/TaskbarVolumeControl.tsx
 * - ../TaskbarRightToolbar.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarRightToolbar volume a11y contract', () => {
	it('uses icon rail chip with range only inside portaled popover', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const volumeSrc = readFileSync(
			join(dir, '../taskbarStrip/TaskbarVolumeControl.tsx'),
			'utf8'
		);
		expect(volumeSrc).toContain('data-volume-mini-popup');
		expect(volumeSrc).toContain('data-volume-level={volumeLevel}');
		expect(volumeSrc).toContain('resolveTaskbarVolumeGlyphLevel');
		expect(volumeSrc).toContain('TaskbarVolumeLevelIcon');
		expect(volumeSrc).not.toContain('<fieldset');
		const railIdx = volumeSrc.indexOf('data-volume-level={volumeLevel}');
		const portalIdx = volumeSrc.indexOf('ShellPortalMount', railIdx);
		expect(railIdx).toBeGreaterThan(0);
		expect(portalIdx).toBeGreaterThan(railIdx);
		const railBlock = volumeSrc.slice(railIdx, portalIdx);
		expect(railBlock).not.toContain('type="range"');
		expect(volumeSrc).toContain('type="range"');
		expect(volumeSrc).toContain('aria-valuetext=');
		expect(volumeSrc).toContain('useDesktopWindowPortalStackBase()');
	});

	it('imports portal stack hook when z-index portal menu is used', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const volumeSrc = readFileSync(
			join(dir, '../taskbarStrip/TaskbarVolumeControl.tsx'),
			'utf8'
		);
		expect(volumeSrc).toContain('useDesktopWindowPortalStackBase()');
		expect(volumeSrc).toContain(
			"useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext'"
		);
	});

	it('parent mounts TaskbarVolumeControl', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentSrc = readFileSync(
			join(dir, '../TaskbarRightToolbar.tsx'),
			'utf8'
		);
		expect(parentSrc).toContain('<TaskbarVolumeControl');
		expect(parentSrc).toContain(
			"import('./taskbarStrip/TaskbarVolumeControl')"
		);
	});
});
