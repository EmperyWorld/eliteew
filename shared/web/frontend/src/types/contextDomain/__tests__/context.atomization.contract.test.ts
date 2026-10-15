/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — context.ts stable path stays a thin facade;
 * implementation children under contextDomain/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports all public context symbols.
 * - Each contextDomain child ≤800 LOC.
 * - types/index.ts still imports from './context'.
 *
 * Related:
 * - ../../context.ts (stable path)
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	CompanySize,
	ContextDataSchema,
	validateContext,
} from '@/types/context';

describe('context atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const typesDir = join(moduleDir, '..');
	const facadePath = join(typesDir, 'context.ts');
	const indexPath = join(typesDir, 'index.ts');

	it('re-exports validateContext, CompanySize, and ContextDataSchema from stable facade', () => {
		expect(typeof validateContext).toBe('function');
		expect(CompanySize.SMALL).toBe('small');
		expect(ContextDataSchema).toBeDefined();
		expect(typeof ContextDataSchema.safeParse).toBe('function');
	});

	it('validateContext accepts minimal company payload with company_name', () => {
		const result = validateContext({
			company_name: 'X',
			industry: 'Y',
			company_size: 'small',
			created_at: '2025-10-24T10:00:00Z',
		});
		expect(result).not.toBeNull();
		expect(result?.company_name).toBe('X');
	});

	it('facade stays ≤50 LOC and only re-exports contextDomain modules', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './contextDomain/enums'");
		expect(src).toContain("from './contextDomain/models'");
		expect(src).toContain("from './contextDomain/schemas'");
		expect(src).not.toMatch(/export enum CompanySize/);
		expect(src).not.toMatch(/export function validateContext/);
		expect(src).not.toMatch(/ContextDataSchema\s*=\s*z\./);
	});

	it('types/index.ts still imports from ./context', () => {
		const indexSrc = readFileSync(indexPath, 'utf8');
		expect(indexSrc).toContain("from './context'");
	});

	it('contextDomain child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'enums.ts',
			'models.ts',
			'schemas.ts',
			'guards.ts',
			'validators.ts',
			'helpers.ts',
			'templateVariables.ts',
		];
		const names = new Set(
			readdirSync(moduleDir).filter((n) => /\.ts$/.test(n) && n !== 'index.ts')
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(moduleDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
