/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks the ContentManagerPro Wave 4/4b thin-shell split and controller hook ownership boundaries.
 *
 * Invariants:
 * - ContentManagerPro.tsx stays under 800 LOC and delegates to useContentManagerProController.
 * - Controller stays under 800 LOC via Wave 4b shell/derived/effects/assembly helpers.
 * - List orchestration, file ops, drag surface, and embedded shell bridge live in dedicated hooks.
 *
 * Related:
 * - ../ContentManagerPro.tsx
 * - ../hooks/useContentManagerProController.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const WAVE4_SUB_HOOKS = [
	'useContentManagerContentListOrchestration',
	'useContentManagerFileOperations',
	'useContentManagerUploadDragSurface',
	'useContentManagerEmbeddedShellBridge',
	'useContentManagerAutoSortActions',
	'useContentManagerBlobUpdateSync',
	'useContentManagerDeepLinkActions',
	'useContentManagerFilesUiDerived',
] as const;

const WAVE4B_CONTROLLER_HELPERS = [
	'useContentManagerProControllerShellState',
	'useContentManagerProControllerDerived',
	'useContentManagerProControllerEffects',
	'buildContentManagerProControllerAssemblyContext',
] as const;

describe('ContentManagerPro Wave 4 import contract', () => {
	it('keeps ContentManagerPro as a thin MainSurface shell', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const pro = readFileSync(join(dir, '../ContentManagerPro.tsx'), 'utf8');
		const lineCount = pro.split('\n').length;

		expect(lineCount).toBeLessThan(800);
		expect(pro).toContain("from './hooks/useContentManagerProController'");
		expect(pro).toContain('useContentManagerProController(props)');
		expect(pro).toContain('<ContentManagerProMainSurface {...surfaceProps} />');
		expect(pro).not.toContain("from './ContentManagerFilesTab'");
		expect(pro).not.toMatch(/const folderView = useFolderView\(/);
		expect(pro).not.toMatch(/const downloadFile\s*=/);
	});

	it('centralizes Wave 4 orchestration in the controller hook', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const controller = readFileSync(
			join(dir, '../hooks/useContentManagerProController.ts'),
			'utf8'
		);
		const assembly = readFileSync(
			join(dir, '../hooks/assembleContentManagerProMainSurfaceProps.ts'),
			'utf8'
		);
		const controllerLineCount = controller.split('\n').length;

		expect(controllerLineCount).toBeLessThan(800);
		expect(controller).toContain(
			"from './assembleContentManagerProMainSurfaceProps'"
		);
		expect(controller).toContain(
			"from './buildContentManagerProControllerAssemblyContext'"
		);
		for (const hook of WAVE4_SUB_HOOKS) {
			expect(controller).toContain(`from './${hook}'`);
		}
		for (const helper of WAVE4B_CONTROLLER_HELPERS) {
			expect(controller).toContain(`from './${helper}'`);
		}
		expect(controller).toContain(
			'return assembleContentManagerProMainSurfaceProps('
		);
		expect(controller).toContain(
			'buildContentManagerProControllerAssemblyContext('
		);
		expect(assembly).toContain('filesBridge:');
		expect(assembly).toContain('modals:');
	});

	it('keeps MainSurface under 800 LOC via TabPanels extract', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const surface = readFileSync(
			join(dir, '../components/ContentManagerProMainSurface.tsx'),
			'utf8'
		);
		const tabPanels = readFileSync(
			join(dir, '../components/ContentManagerProMainSurfaceTabPanels.tsx'),
			'utf8'
		);
		expect(surface.split('\n').length).toBeLessThan(800);
		expect(surface).toContain("from './ContentManagerProMainSurfaceTabPanels'");
		expect(surface).toContain('<ContentManagerProMainSurfaceTabPanels');
		expect(surface).toContain('FolderOpenIcon');
		expect(surface).toMatch(
			/import\s*\{[^}]*FolderOpenIcon[^}]*\}\s*from\s*'@heroicons\/react\/24\/outline'/
		);
		expect(tabPanels).toContain('ContentManagerProFilesTabBridge');
		expect(tabPanels.split('\n').length).toBeLessThan(800);
	});

	it('preserves tag-select catalog jump in assembly builder', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const builder = readFileSync(
			join(dir, '../hooks/buildContentManagerProControllerAssemblyContext.ts'),
			'utf8'
		);
		expect(builder).toContain("setFilesBrowseMode('catalog')");
		expect(builder).toContain("setSearchQuery('')");
		expect(builder).toContain('resolveContentManagerListPaginationTotal');
	});

	it('exports public props from contentManagerProTypes', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const pro = readFileSync(join(dir, '../ContentManagerPro.tsx'), 'utf8');
		const types = readFileSync(
			join(dir, '../contentManagerProTypes.ts'),
			'utf8'
		);

		expect(pro).toContain("from './contentManagerProTypes'");
		expect(types).toContain('export interface ContentManagerProProps');
		expect(types).toContain('export interface ContentManagerCabinetScope');
	});
});
