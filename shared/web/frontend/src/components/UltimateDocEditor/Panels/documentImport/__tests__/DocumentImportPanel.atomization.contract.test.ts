/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for DocumentImportPanel: facade keeps named export while
 * mappers, hooks, UI subpanels, and compose hook live under documentImport/.
 *
 * Invariants:
 * - Parent Panels/DocumentImportPanel.tsx re-exports DocumentImportPanel and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useDocumentImportCompose wires format helpers, dropzone, and batch import.
 *
 * Related:
 * - Panels/DocumentImportPanel.tsx, useDocumentImportCompose.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const documentImportDir = join(dir, '..');
const panelsDir = join(documentImportDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('DocumentImportPanel atomization contract', () => {
	const facadePath = join(panelsDir, 'DocumentImportPanel.tsx');
	const innerPath = join(documentImportDir, 'DocumentImportPanel.tsx');

	const mapperModules = [
		'documentImportTypes.ts',
		'importPayloadMappers.ts',
		'detectFileFormat.ts',
	] as const;

	const hookModules = [
		'useDocumentImportFormatHelpers.tsx',
		'useDocumentImportDropzone.ts',
		'useDocumentImportBatch.ts',
		'useDocumentImportCompose.ts',
	] as const;

	const uiModules = [
		'DocumentImportHeader.tsx',
		'DocumentImportDropzone.tsx',
		'DocumentImportFileList.tsx',
		'DocumentImportProgress.tsx',
		'DocumentImportResults.tsx',
		'DocumentImportActions.tsx',
	] as const;

	const allChildModules = [
		...mapperModules,
		...hookModules,
		...uiModules,
	] as const;

	it('facade re-exports DocumentImportPanel from documentImport/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*DocumentImportPanel\s*\}\s+from\s+['"]@\/components\/UltimateDocEditor\/Panels\/documentImport\/DocumentImportPanel['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*DocumentImportPanelProps\s*\}/);
	});

	it('inner panel delegates to useDocumentImportCompose and subpanels', () => {
		const src = read(innerPath);
		expect(src).toContain(
			"from '@/components/UltimateDocEditor/Panels/documentImport/useDocumentImportCompose'"
		);
		expect(src).toContain('useDocumentImportCompose(');
		expect(src).toContain('<DocumentImportHeader');
		expect(src).toContain('<DocumentImportDropzone');
		expect(src).toContain('<DocumentImportFileList');
		expect(src).toContain('<DocumentImportProgress');
		expect(src).toContain('<DocumentImportResults');
		expect(src).toContain('<DocumentImportActions');
		expect(src).not.toMatch(/\bfunction\s+importPayloadToUltimateDocument\b/);
		expect(src).not.toMatch(/\bfunction\s+isFileSystemDirectoryEntry\b/);
		expect(src).not.toMatch(/\basync\s+function\s+detectFileFormat\b/);
	});

	it('useDocumentImportCompose wires format helpers, dropzone, batch', () => {
		const src = read(join(documentImportDir, 'useDocumentImportCompose.ts'));
		expect(src).toContain('useDocumentImportFormatHelpers(');
		expect(src).toContain('useDocumentImportDropzone(');
		expect(src).toContain('useDocumentImportBatch(');
		expect(src).toContain('selectDocumentImportPanelSlice');
		expect(src).toContain('importFiles');
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(documentImportDir, 'importPayloadMappers.ts'))).toContain(
			'export function importPayloadToUltimateDocument'
		);
		expect(read(join(documentImportDir, 'importPayloadMappers.ts'))).toContain(
			'export function isFileSystemDirectoryEntry'
		);
		expect(read(join(documentImportDir, 'detectFileFormat.ts'))).toContain(
			'export async function detectFileFormat'
		);
		expect(
			read(join(documentImportDir, 'useDocumentImportDropzone.ts'))
		).toContain('handleDrop');
		expect(
			read(join(documentImportDir, 'useDocumentImportBatch.ts'))
		).toContain('enhanceLegacyDoc');
		expect(read(join(documentImportDir, 'documentImportTypes.ts'))).toContain(
			'SUPPORTED_FORMATS'
		);
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(documentImportDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		const innerLoc = lineCount(innerPath);
		expect(facadeLoc).toBeLessThanOrEqual(50);
		expect(innerLoc).toBeLessThanOrEqual(800);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(documentImportDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
