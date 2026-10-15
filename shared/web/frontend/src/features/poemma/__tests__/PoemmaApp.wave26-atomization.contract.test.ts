/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks Wave 26+ PoemmaApp shell atomization under 800 LOC.
 *
 * Invariants:
 * - PoemmaApp.tsx stays under 800 and imports routing + route body modules.
 * - poemmaAppRouting.ts and PoemmaRouteBody.tsx each stay under 800 LOC.
 *
 * Related:
 * - ../PoemmaApp.tsx, ../poemmaAppRouting.ts, ../PoemmaRouteBody.tsx
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MODULES = [
	'PoemmaApp.tsx',
	'poemmaAppRouting.ts',
	'PoemmaRouteBody.tsx',
] as const;

describe('PoemmaApp Wave 26+ atomization contract', () => {
	it('keeps shell modules under 800 LOC', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		for (const name of MODULES) {
			const source = readFileSync(join(dir, '..', name), 'utf8');
			expect(source.split('\n').length, `${name} LOC`).toBeLessThan(800);
		}
	});

	it('keeps PoemmaApp as thin shell over routing + route body', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const app = readFileSync(join(dir, '../PoemmaApp.tsx'), 'utf8');
		expect(app).toContain("from './poemmaAppRouting'");
		expect(app).toContain("from './PoemmaRouteBody'");
		expect(app).toContain('export function PoemmaApp()');
		expect(app).not.toContain('const POEMMA_PAGES');
		expect(app).not.toContain('function resolvePoemmaRoute');
		expect(app).not.toContain('function WorkspaceBootstrap');
		expect(app).not.toMatch(/switch \(page\.path\)/);
	});
});
