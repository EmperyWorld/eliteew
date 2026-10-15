/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P37 atomization contract: thin DesktopVisualStudioPreviewInteractive aggregator + module split.
 *
 * Related:
 * - settings/DesktopVisualStudioPreviewInteractive.tsx
 * - settings/desktopVisualStudioPreviewInteractive/*
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DesktopVisualStudioPreviewInteractive,
	type DesktopVisualStudioPreviewInteractiveProps,
} from '../DesktopVisualStudioPreviewInteractive';

describe('DesktopVisualStudioPreviewInteractive P37 atomization contract', () => {
	it('parent stays under 800 LOC and re-exports key public API', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(
			dir,
			'../DesktopVisualStudioPreviewInteractive.tsx'
		);
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain(
			"from './desktopVisualStudioPreviewInteractive/types'"
		);
		expect(src).toContain(
			"from './desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive'"
		);
		expect(src).toContain(
			'export type { DesktopVisualStudioPreviewInteractiveProps }'
		);
		expect(src).toContain('export { DesktopVisualStudioPreviewInteractive }');
	});

	it('runtime re-exports resolve for component and props type', () => {
		expect(typeof DesktopVisualStudioPreviewInteractive).toBe('function');
		// Props type is compile-time only; assert module shape via import
		const propsTypeCheck: DesktopVisualStudioPreviewInteractiveProps | null =
			null;
		expect(propsTypeCheck).toBeNull();
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopVisualStudioPreviewInteractive');
		const modules = readdirSync(childDir).filter(
			(f) => f.endsWith('.ts') || f.endsWith('.tsx')
		);
		expect(modules.length).toBeGreaterThanOrEqual(5);
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('implementation module owns hotspot popover and content split', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const implPath = join(
			dir,
			'../desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive.tsx'
		);
		const popoverPath = join(
			dir,
			'../desktopVisualStudioPreviewInteractive/VisualStudioHotspotPopover.tsx'
		);
		const contentPath = join(
			dir,
			'../desktopVisualStudioPreviewInteractive/hotspotPopoverContent.tsx'
		);
		const implSrc = readFileSync(implPath, 'utf8');
		const popoverSrc = readFileSync(popoverPath, 'utf8');
		const contentSrc = readFileSync(contentPath, 'utf8');

		expect(implSrc).toContain('VisualStudioHotspotPopover');
		expect(implSrc).toContain('renderHotspotPopoverContent');
		expect(popoverSrc).toContain('ShellPortalMount');
		expect(contentSrc).toContain('renderHotspotPopoverContent');
		expect(contentSrc).toContain('segmentButtonClass');
	});
});
