/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock taskbar rail premium chrome: quiet VD name chip, volume percent,
 * clock date; no uppercase compact-menu title; volume popover keeps label + valuetext.
 *
 * Related:
 * - taskbarChrome.ts, TaskbarVolumeControl.tsx, TaskbarClock.tsx
 * - VirtualDesktops.tsx, VirtualDesktopsCompactMenu.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	TASKBAR_CLOCK_DATE_CLASS,
	TASKBAR_VD_COMPACT_MENU_TITLE_CLASS,
	TASKBAR_VD_NAME_CHIP_CLASS,
	TASKBAR_VOLUME_PERCENT_CLASS,
} from '../taskbarChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Taskbar rail premium chrome', () => {
	it('keeps VD chip / volume / clock tokens quiet', () => {
		expect(TASKBAR_VD_NAME_CHIP_CLASS).not.toMatch(/rounded-full/);
		expect(TASKBAR_VD_NAME_CHIP_CLASS).toMatch(/tracking-normal/);
		expect(TASKBAR_VD_COMPACT_MENU_TITLE_CLASS).not.toMatch(/\buppercase\b/);
		expect(TASKBAR_VOLUME_PERCENT_CLASS).toMatch(/tracking-normal/);
		expect(TASKBAR_CLOCK_DATE_CLASS).toMatch(/taskbarTrayMeta|tabular-nums/);
	});

	it('wires chrome tokens and volume popover label + valuetext', () => {
		const volume = stripComments(readSrc('../TaskbarVolumeControl.tsx'));
		const clock = stripComments(readSrc('../../TaskbarClock.tsx'));
		const vd = stripComments(readSrc('../../VirtualDesktops.tsx'));
		const compact = stripComments(
			readSrc('../../VirtualDesktopsCompactMenu.tsx')
		);

		expect(volume).toContain('TASKBAR_VOLUME_PERCENT_CLASS');
		expect(volume).toContain("t('taskbar.taskbarVolumeLabel')");
		expect(volume).toContain('aria-valuetext=');
		expect(volume).not.toContain('<legend');
		expect(volume).toContain('data-volume-level={volumeLevel}');
		expect(clock).toContain('TASKBAR_CLOCK_DATE_CLASS');
		expect(vd).toContain('TASKBAR_VD_NAME_CHIP_CLASS');
		expect(vd).not.toContain('shellVirtualDesktopCounter');
		expect(compact).toContain('TASKBAR_VD_COMPACT_MENU_TITLE_CLASS');
		expect(compact).not.toMatch(/\buppercase\b/);
	});
});
