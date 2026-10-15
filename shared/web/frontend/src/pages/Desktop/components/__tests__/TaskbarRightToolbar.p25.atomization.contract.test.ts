/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P25 atomization lock — TaskbarRightToolbar orchestrator ≤800 LOC; volume in TaskbarVolumeControl.
 *
 * Related:
 * - ../TaskbarRightToolbar.tsx
 * - ../taskbarStrip/TaskbarVolumeControl.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TASKBAR_RIGHT_TOOLBAR_LOC_CAP = 800;

describe('TaskbarRightToolbar P25 atomization contract', () => {
	it('parent orchestrator stays at or under LOC cap', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskbarRightToolbar.tsx'), 'utf8');
		const lineCount = src.split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(TASKBAR_RIGHT_TOOLBAR_LOC_CAP);
	});

	it('imports and mounts TaskbarVolumeControl', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskbarRightToolbar.tsx'), 'utf8');
		expect(src).toContain("import('./taskbarStrip/TaskbarVolumeControl')");
		expect(src).toContain('<TaskbarVolumeControl');
	});

	it('exports TaskbarRightToolbar and props type', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../TaskbarRightToolbar.tsx'), 'utf8');
		expect(src).toContain('export type TaskbarRightToolbarProps');
		expect(src).toContain('export const TaskbarRightToolbar');
	});
});
