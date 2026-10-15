/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: packages purged in dependency-health Step 1 must not
 * reappear as direct SPA dependencies or workspace overrides.
 *
 * Invariants:
 * - Direct deps/devDeps must not list keycloak-js, jspdf, codemirror, immer,
 *   jszip, or rollup-plugin-polyfill-node.
 * - pnpm-workspace.yaml overrides must not pin unused `codemirror`.
 *
 * Related:
 * - documentation/platform/FRONTEND-LICENSE-CLEANUP.md
 * - canvases/eliteew-frontend-dependency-health.canvas.tsx
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd());
const PURGED_DIRECT = [
	'keycloak-js',
	'jspdf',
	'codemirror',
	'immer',
	'jszip',
	'rollup-plugin-polyfill-node',
] as const;

describe('frontend dead-dep purge lock', () => {
	it('package.json does not reintroduce purged directs', () => {
		const pkg = JSON.parse(
			readFileSync(join(ROOT, 'package.json'), 'utf8')
		) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		const directs = {
			...(pkg.dependencies ?? {}),
			...(pkg.devDependencies ?? {}),
		};
		for (const name of PURGED_DIRECT) {
			expect(
				directs[name],
				`${name} must not be a direct dependency`
			).toBeUndefined();
		}
	});

	it('pnpm-workspace.yaml does not override unused codemirror', () => {
		const yaml = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
		expect(yaml).not.toMatch(/^\s*codemirror\s*:/m);
	});
});
