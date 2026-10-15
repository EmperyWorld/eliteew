import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ContentManagerFilesTab split contract', () => {
	const dir = dirname(fileURLToPath(import.meta.url));
	const tabSrc = readFileSync(
		join(dir, '../ContentManagerFilesTab.tsx'),
		'utf8'
	);

	it('keeps main tab under 800 LOC after decomposition', () => {
		const lineCount = tabSrc.split('\n').length;
		expect(lineCount).toBeLessThan(800);
	});

	it('delegates list body to ContentManagerFilesListBody', () => {
		expect(tabSrc).toContain('ContentManagerFilesListBody');
		expect(tabSrc).not.toMatch(/DesktopAppEmptyState/);
	});

	it('delegates selection bar to ContentManagerFilesSelectionBar', () => {
		expect(tabSrc).toContain('ContentManagerFilesSelectionBar');
	});

	it('delegates explorer tree to ContentManagerFilesExplorerTree', () => {
		expect(tabSrc).toContain('ContentManagerFilesExplorerTree');
	});

	it('uses shared search chrome components', () => {
		expect(tabSrc).toContain('ContentManagerFilesSplitSearchChrome');
		expect(tabSrc).toContain('ContentManagerFilesStackSearchChrome');
	});

	it('exports props type from contentManagerFilesTabTypes', () => {
		expect(tabSrc).toContain("from './contentManagerFilesTabTypes'");
		const typesSrc = readFileSync(
			join(dir, '../contentManagerFilesTabTypes.ts'),
			'utf8'
		);
		expect(typesSrc).toContain('export interface ContentManagerFilesTabProps');
	});
});
