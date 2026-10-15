/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structural regression lock for the Professional Worlds API Zod domain atomization.
 *
 * Invariants:
 * - The legacy import path remains a thin export-only barrel.
 * - Every domain module stays below the repository god-file threshold.
 *
 * Related:
 * - ../professionalWorldsApiZod.ts
 * - ../zod/
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = join(__dirname, '..');
const BARREL_PATH = join(DESKTOP_ROOT, 'professionalWorldsApiZod.ts');
const ZOD_ROOT = join(DESKTOP_ROOT, 'zod');

function countLines(path: string): number {
	const source = readFileSync(path, 'utf8').trimEnd();
	return source.length === 0 ? 0 : source.split(/\r?\n/).length;
}

describe('professionalWorldsApiZod atomization contract', () => {
	it('keeps the compatibility barrel thin and export-only', () => {
		expect(existsSync(BARREL_PATH)).toBe(true);
		expect(statSync(BARREL_PATH).isFile()).toBe(true);
		expect(countLines(BARREL_PATH)).toBeLessThanOrEqual(150);

		const source = readFileSync(BARREL_PATH, 'utf8');
		const executableLines = source
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);

		expect(executableLines.length).toBeGreaterThanOrEqual(10);
		expect(
			executableLines.every((line) =>
				/^export \* from '\.\/zod\/[^']+';$/.test(line)
			)
		).toBe(true);
	});

	it('keeps every Zod domain module at or below 800 LOC', () => {
		const modules = readdirSync(ZOD_ROOT)
			.filter((name) => name.endsWith('.ts'))
			.sort();

		expect(modules.length).toBeGreaterThanOrEqual(10);
		for (const moduleName of modules) {
			expect(
				countLines(join(ZOD_ROOT, moduleName)),
				`${moduleName} exceeds 800 LOC`
			).toBeLessThanOrEqual(800);
		}
	});

	it('re-exports representative symbols from every dependency layer', async () => {
		const barrel = await import('../professionalWorldsApiZod');

		expect(barrel.ProfessionalWorldsApiParseError).toBeTypeOf('function');
		expect(barrel.professionalClientOutSchema).toBeDefined();
		expect(barrel.realtorPropertyOutSchema).toBeDefined();
		expect(barrel.professionalWorldsRuntimeConfigOutSchema).toBeDefined();
		expect(barrel.snapshotOutSchema).toBeDefined();
		expect(barrel.parseProfessionalWorldsSnapshotOut).toBeTypeOf('function');
		expect(barrel.parseProfessionalCrossAppDraftLinkOutList).toBeTypeOf(
			'function'
		);
	});
});
