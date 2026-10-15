/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dist guard: cold entry chunks must not statically import Excalidraw/Recharts graphs.
 *
 * Invariants:
 * - Skips when ``dist-build/assets`` is missing (no build in this job).
 * - Fails when ``main`` / ``mainFullApp`` / ``cn`` import paths matching excalidraw* or recharts*.
 *
 * Related:
 * - `vite.config.ts` manualChunks, `FRONTEND-TOOLCHAIN-AND-BUILD.md`
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSETS_DIR = join(process.cwd(), 'dist-build', 'assets');
const HEAVY_IMPORT_RE =
	/from\s*["']\.\/(?:excalidraw[^"']*|recharts[^"']*|monaco[^"']*|exceljs[^"']*|katex[^"']*|markdown-vendor[^"']*|canvas-vendor[^"']*|flow-vendor[^"']*|presentation-vendor[^"']*|doc-io-vendor[^"']*)["']/g;

function entryFiles(): string[] {
	if (!existsSync(ASSETS_DIR)) return [];
	return readdirSync(ASSETS_DIR).filter(
		(name) =>
			/^(main|mainFullApp|cn)-[^/]+\.js$/.test(name) && !name.endsWith('.map')
	);
}

describe('dist cold-entry chunk isolation', () => {
	it('entry chunks do not statically import excalidraw/recharts', () => {
		const files = entryFiles();
		if (files.length === 0) {
			// Local unit runs without a prior production build are OK.
			expect(files.length).toBe(0);
			return;
		}

		const violations: string[] = [];
		for (const name of files) {
			const code = readFileSync(join(ASSETS_DIR, name), 'utf8');
			const hits = code.match(HEAVY_IMPORT_RE) ?? [];
			for (const hit of hits) {
				violations.push(`${name}: ${hit}`);
			}
		}

		expect(violations).toEqual([]);
	});
});
