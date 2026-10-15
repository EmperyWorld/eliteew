/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P34 atomization contract: thin DesktopWorkspaceFloatingWidget aggregator + module split.
 *
 * Related:
 * - components/DesktopWorkspaceFloatingWidget.tsx
 * - components/desktopWorkspaceFloatingWidget/*
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopWorkspaceFloatingWidget P34 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../DesktopWorkspaceFloatingWidget.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain(
			"from './desktopWorkspaceFloatingWidget/DesktopWorkspaceFloatingWidget'"
		);
		expect(src).toContain('export {');
		expect(src).toContain('DesktopWorkspaceFloatingWidget');
		expect(src).toContain('DesktopWorkspaceFloatingWidgetProps');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopWorkspaceFloatingWidget');
		const modules = readdirSync(childDir).filter(
			(f) => f.endsWith('.ts') || f.endsWith('.tsx')
		);
		expect(modules.length).toBeGreaterThan(0);
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('implementation folder imports drag/placement and now-playing modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const implPath = join(
			dir,
			'../desktopWorkspaceFloatingWidget/DesktopWorkspaceFloatingWidget.tsx'
		);
		const src = readFileSync(implPath, 'utf8');
		expect(src).toContain("from './useFloatingWidgetDrag'");
		expect(src).toContain("from './DesktopFloatingWidgetNowPlayingStrip'");
		expect(src).toContain("from './helpers'");
		expect(src).toContain('isFwContextMenuBlockedTarget');
	});
});
