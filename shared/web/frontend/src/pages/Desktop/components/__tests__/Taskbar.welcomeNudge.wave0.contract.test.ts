/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 0 source lock — welcome nudge seats above the taskbar in absolute
 * ui-scale space and wires in-viewport reachability (never bottom-full / fixed).
 *
 * Related:
 * - components/Taskbar.tsx
 * - hooks/useDesktopInViewportReachability.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const taskbarSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../Taskbar.tsx'
);

describe('Taskbar welcome nudge reachability (Wave 0)', () => {
	const src = readFileSync(taskbarSourcePath, 'utf8');

	it('seats the nudge with absolute bottom above taskbar height', () => {
		expect(src).toContain('data-testid="desktop-welcome-nudge-slot"');
		expect(src).toContain('absolute inset-x-0');
		expect(src).toContain('TASKBAR.HEIGHT_PX');
		expect(src).not.toMatch(
			/desktop-welcome-nudge-slot[\s\S]{0,400}bottom-full/
		);
		expect(src).not.toMatch(
			/desktop-welcome-nudge-slot[\s\S]{0,200}fixed inset-x-0/
		);
	});

	it('wires useDesktopInViewportReachability for inert off-viewport', () => {
		expect(src).toContain('useDesktopInViewportReachability');
		expect(src).toContain('welcomeNudgeSlotRef');
	});
});
