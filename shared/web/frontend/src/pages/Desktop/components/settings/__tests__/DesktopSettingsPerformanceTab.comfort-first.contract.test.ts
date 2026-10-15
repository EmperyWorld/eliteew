/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Comfort tab IA: smoothness before session-status; soft-blur nested inside.
 *
 * Related:
 * - ../DesktopSettingsPerformanceTab.tsx
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopSettingsPerformanceTab comfort-first IA', () => {
	it('keeps smoothness primary and session metrics behind disclosure', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../DesktopSettingsPerformanceTab.tsx'),
			'utf8'
		);

		const smoothnessIdx = src.indexOf('cardSmoothnessEffectsTitle');
		const experimentalIdx = src.indexOf(
			'data-testid="desktop-settings-comfort-experimental-effects"'
		);
		const sessionStatusIdx = src.indexOf(
			'data-testid="desktop-settings-comfort-session-status"'
		);
		const realtimeIdx = src.indexOf('perfRealtimeMarksLabel');
		expect(smoothnessIdx).toBeGreaterThan(-1);
		expect(experimentalIdx).toBeGreaterThan(-1);
		expect(sessionStatusIdx).toBeGreaterThan(-1);
		expect(smoothnessIdx).toBeLessThan(sessionStatusIdx);
		expect(sessionStatusIdx).toBeLessThan(experimentalIdx);
		expect(realtimeIdx).toBeGreaterThan(experimentalIdx);
		expect(src.indexOf('inactive_window_soft_blur_experiment')).toBeGreaterThan(
			experimentalIdx
		);
	});
});
