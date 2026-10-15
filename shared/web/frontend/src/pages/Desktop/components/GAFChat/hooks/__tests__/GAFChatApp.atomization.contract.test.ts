/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract: GAFChatApp parent ≤800 LOC with stable default export
 * and orchestration hook extract (core + phase-2 slices).
 *
 * Invariants:
 * - Parent GAFChatApp.tsx ≤800 lines; default export remains at canonical path.
 * - Orchestration hook modules each ≤800 lines.
 *
 * Related:
 * - GAFChatApp.tsx
 * - hooks/useGafChatAppOrchestration.ts
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const gafChatDir = join(dir, '..', '..');
const hooksDir = join(gafChatDir, 'hooks');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('GAFChatApp atomization contract', () => {
	const parentPath = join(gafChatDir, 'GAFChatApp.tsx');
	const hookFiles = [
		'useGafChatAppOrchestration.ts',
		'useGafChatAppOrchestrationCore.ts',
		'useGafChatAppOrchestrationPhase2.ts',
	] as const;

	it('parent GAFChatApp.tsx is ≤800 LOC with default export', () => {
		const src = read(parentPath);
		expect(lineCount(parentPath)).toBeLessThanOrEqual(800);
		expect(src).toMatch(/export\s+default\s+GAFChatApp\b/);
	});

	it('wires useGafChatAppOrchestration and buildGafChatAppWorkspaceModel', () => {
		const src = read(parentPath);
		expect(src).toContain("from './hooks/useGafChatAppOrchestration'");
		expect(src).toContain("from './hooks/buildGafChatAppWorkspaceModel'");
		expect(src).toContain('useGafChatAppOrchestration(');
		expect(src).toContain('buildGafChatAppWorkspaceModel(');
		expect(src).toContain('<GafChatAppWorkspace');
	});

	it('lazy import path remains stable for desktopWindowAppContent', () => {
		const lazyImportsPath = join(
			gafChatDir,
			'../desktopWindowAppContent/lazyImports.ts'
		);
		const lazySrc = read(lazyImportsPath);
		expect(lazySrc).toContain("import('../GAFChat/GAFChatApp')");
	});

	it('orchestration hook modules exist and are ≤800 LOC each', () => {
		for (const name of hookFiles) {
			const path = join(hooksDir, name);
			expect(lineCount(path)).toBeLessThanOrEqual(800);
		}
	});
});
