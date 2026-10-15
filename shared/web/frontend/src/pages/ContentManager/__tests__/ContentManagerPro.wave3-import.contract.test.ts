/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks the ContentManagerPro structural split and folder-view explorer read boundary.
 *
 * Invariants:
 * - Parent imports focused explorer/preview/bulk hooks plus MainSurface.
 * - MainSurface owns FilesTabBridge and modal-stack imports.
 *
 * Related:
 * - ../ContentManagerPro.tsx
 * - ../components/ContentManagerProMainSurface.tsx
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ContentManagerPro Wave 3 import contract', () => {
	it('delegates explorer, preview, bulk, and presentation surface behavior', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const pro = readFileSync(join(dir, '../ContentManagerPro.tsx'), 'utf8');
		const controller = readFileSync(
			join(dir, '../hooks/useContentManagerProController.ts'),
			'utf8'
		);
		const surface = readFileSync(
			join(dir, '../components/ContentManagerProMainSurface.tsx'),
			'utf8'
		);

		expect(pro).toContain("from './hooks/useContentManagerProController'");
		expect(pro).toContain('useContentManagerProController(props)');
		expect(controller).toContain("from './useContentManagerExplorerFolders'");
		expect(controller).toContain("from './useContentManagerPreviewKeyboard'");
		expect(controller).toContain("from './useContentManagerBulkModals'");
		expect(pro).toContain("from './components/ContentManagerProMainSurface'");
		expect(pro).not.toContain("from './ContentManagerFilesTab'");
		expect(pro).not.toMatch(/const createFolderUnderParent\s*=/);
		expect(pro).not.toMatch(/const executeBulkMove\s*=/);
		expect(pro).not.toMatch(/const openPreviousPreview\s*=/);
		expect(pro).not.toMatch(/<ContentManagerFilesTab[\s>]/);

		expect(surface).toContain("from './ContentManagerProModals'");
		expect(surface).toContain("from './ContentManagerProFilesTabBridge'");
	});

	it('wires explorer files and nested folders through useFolderView', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const orchestration = readFileSync(
			join(dir, '../hooks/useContentManagerContentListOrchestration.ts'),
			'utf8'
		);
		const controller = readFileSync(
			join(dir, '../hooks/useContentManagerProController.ts'),
			'utf8'
		);

		expect(orchestration).toContain("from '../../../hooks/useFolderView'");
		expect(orchestration).toContain('const folderView = useFolderView({');
		expect(controller).toContain(
			"from './useContentManagerContentListOrchestration'"
		);
		expect(controller).toContain(
			'folderViewDesktopChildren: folderView.desktopChildren'
		);
	});
});
