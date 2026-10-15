/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P35 atomization contract: thin desktopApi aggregator + module split under `desktopApi/`.
 *
 * Related:
 * - services/desktopApi.ts
 * - services/desktopApi/*
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DesktopShellStateConflictError,
	getDesktopConfig,
	patchDesktopShellState,
	SHELL_STATE_CONFLICT_MESSAGE,
} from '../desktopApi';

describe('desktopApi P35 atomization contract', () => {
	it('parent stays under 800 LOC and re-exports key public API', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../desktopApi.ts');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './desktopApi/shellState'");
		expect(src).toContain("from './desktopApi/config'");
		expect(src).toContain("from './desktopApi/conflict'");
		expect(src).toContain('export {');
	});

	it('runtime re-exports resolve for shell conflict, config, and shell-state PATCH', () => {
		expect(SHELL_STATE_CONFLICT_MESSAGE).toContain('another session');
		expect(DesktopShellStateConflictError.name).toBe(
			'DesktopShellStateConflictError'
		);
		expect(typeof getDesktopConfig).toBe('function');
		expect(typeof patchDesktopShellState).toBe('function');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopApi');
		const modules = readdirSync(childDir).filter((f) => f.endsWith('.ts'));
		expect(modules.length).toBeGreaterThanOrEqual(8);
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('shellState module owns cache/dedupe and conflict helpers', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const shellPath = join(dir, '../desktopApi/shellState.ts');
		const src = readFileSync(shellPath, 'utf8');
		expect(src).toContain('fetchDesktopShellStateDeduplicated');
		expect(src).toContain('seedDesktopShellStateFromBootstrap');
		expect(src).toContain('patchDesktopShellStateKeepalive');
		expect(src).toContain('clearDesktopShellStateCache');
		expect(src).toContain('DesktopShellStateConflictError');
	});
});
