/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Manager explorer rail must resolve system folder labels via shared display helper.
 *
 * Related:
 * - ../ContentManagerFilesExplorerTree.tsx
 * - pages/Desktop/utils/desktopSystemFolderLabels.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ContentManagerFilesExplorerTree display i18n contract', () => {
	it('uses resolveDesktopFolderDisplayName for tree and collapsed rail', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../ContentManagerFilesExplorerTree.tsx'),
			'utf8'
		);
		expect(src).toContain('resolveDesktopFolderDisplayName');
		expect(src).toContain("useTranslation('desktopUi')");
		expect(src).toContain(
			'const displayName = resolveDesktopFolderDisplayName'
		);
	});
});
