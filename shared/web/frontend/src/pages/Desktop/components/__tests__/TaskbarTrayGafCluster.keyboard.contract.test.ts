/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for tray panel layered Escape.
 *
 * Related:
 * - src/pages/Desktop/components/TaskbarTrayGafCluster.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarTrayGafCluster keyboard contract', () => {
	it('delegates tray panel Escape to useShellCaptureEscape', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskbarTrayGafCluster.tsx'), 'utf8');
		expect(src).toContain('useShellCaptureEscape(showTray');
		expect(src).toContain('ShellPortalMount');
		expect(src).toContain('@/pages/Desktop/shell/shellPortal');
		expect(src).toContain('aria-controls={DESKTOP_TRAY_PANEL_ID}');
		expect(src).toContain('resolveTraySurfaceBadge');
		expect(src).not.toContain('traySurfaceBadgeCount');
	});

	it('keeps healthy tray indicators free of idle infinite animations', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const gafSrc = readFileSync(
			join(dir, '../TaskbarTrayGafCluster.tsx'),
			'utf8'
		);
		const sessionSrc = readFileSync(
			join(dir, '../SessionDeviceTrayButton.tsx'),
			'utf8'
		);

		expect(gafSrc).not.toContain('repeat: Infinity');
		expect(sessionSrc).toContain('const shouldPulse = active && !reduceMotion');
		expect(sessionSrc).toContain('transition={');
		expect(sessionSrc).toContain('shouldPulse');
	});
});
