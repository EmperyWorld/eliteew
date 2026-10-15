/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for FileManagerPanel: facade keeps named export while
 * constants, types, row components, hook, and compose panel live under fileManager/.
 *
 * Invariants:
 * - Parent Panels/FileManagerPanel.tsx re-exports FileManagerPanel and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useFileManagerPanel wires list fetch, sort, search, and pagination state.
 *
 * Related:
 * - Panels/FileManagerPanel.tsx, useFileManagerPanel.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { FileManagerPanel } from '@/components/UltimateDocEditor/Panels/FileManagerPanel';

const dir = dirname(fileURLToPath(import.meta.url));
const fileManagerDir = join(dir, '..');
const panelsDir = join(fileManagerDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('FileManagerPanel atomization contract', () => {
	const facadePath = join(panelsDir, 'FileManagerPanel.tsx');
	const innerPath = join(fileManagerDir, 'FileManagerPanel.tsx');

	const sharedModules = [
		'fileManagerConstants.ts',
		'fileManagerTypes.ts',
	] as const;

	const hookModules = ['useFileManagerPanel.ts'] as const;

	const uiModules = [
		'FileManagerDocRow.tsx',
		'FileManagerRecentDocRow.tsx',
	] as const;

	const allChildModules = [
		...sharedModules,
		...hookModules,
		...uiModules,
	] as const;

	it('re-exports named FileManagerPanel from stable facade path', () => {
		expect(typeof FileManagerPanel).toBe('function');
	});

	it('facade re-exports FileManagerPanel from fileManager/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*FileManagerPanel\s*\}\s+from\s+['"]@\/components\/UltimateDocEditor\/Panels\/fileManager\/FileManagerPanel['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*FileManagerPanelProps\s*\}/);
	});

	it('UltimateDocEditorPanelOverlays still imports FileManagerPanel stable path', () => {
		const overlaysPath = join(
			panelsDir,
			'../chrome/UltimateDocEditorPanelOverlays.tsx'
		);
		const src = read(overlaysPath);
		expect(src).toContain("import('../Panels/FileManagerPanel')");
		expect(src).toContain('m.FileManagerPanel');
	});

	it('inner panel delegates to useFileManagerPanel and row subpanels', () => {
		const src = read(innerPath);
		expect(src).toContain("from './useFileManagerPanel'");
		expect(src).toContain('useFileManagerPanel(');
		expect(src).toContain('<FileManagerDocRow');
		expect(src).toContain('<FileManagerRecentDocRow');
		expect(src).not.toMatch(/\bfunction\s+stripHtmlPreview\b/);
		expect(src).not.toMatch(/\bconst\s+FileManagerDocRow\s*=/);
	});

	it('useFileManagerPanel wires list fetch, sort, search, pagination', () => {
		const src = read(join(fileManagerDir, 'useFileManagerPanel.ts'));
		expect(src).toContain('selectFileManagerPanelSlice');
		expect(src).toContain('listDocuments');
		expect(src).toContain('debouncedSearch');
		expect(src).toContain('loadFileLibraryPanel');
		expect(src).toContain('requestIdleCallback');
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(fileManagerDir, 'fileManagerConstants.ts'))).toContain(
			'export const VIRTUAL_LIST_MIN = 28'
		);
		expect(read(join(fileManagerDir, 'fileManagerConstants.ts'))).toContain(
			'export function stripHtmlPreview'
		);
		expect(read(join(fileManagerDir, 'fileManagerTypes.ts'))).toContain(
			'FileManagerPanelProps'
		);
		expect(read(join(fileManagerDir, 'FileManagerDocRow.tsx'))).toContain(
			'export const FileManagerDocRow'
		);
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(fileManagerDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		const innerLoc = lineCount(innerPath);
		expect(facadeLoc).toBeLessThanOrEqual(50);
		expect(innerLoc).toBeLessThanOrEqual(800);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(fileManagerDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
