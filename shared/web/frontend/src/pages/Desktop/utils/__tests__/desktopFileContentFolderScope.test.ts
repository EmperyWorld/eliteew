/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop file → unified content folder/project scope sync helpers.
 */

import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	buildContentFolderScopePatch,
	collectDesktopFileParentScopeChanges,
} from '../desktopFileContentFolderScope';

const PROJECT_FOLDER = 'eliteew-proj-550e8400-e29b-41d4-a716-446655440000';

function file(id: string, parentId?: string): DesktopItem {
	return {
		id,
		name: id,
		type: 'file',
		position: { x: 0, y: 0 },
		parentId,
	};
}

describe('buildContentFolderScopePatch', () => {
	it('clears folder, project, and company on desktop root', () => {
		expect(buildContentFolderScopePatch(undefined)).toEqual({
			folder_item_id: null,
			project_id: null,
			company_id: null,
		});
	});

	it('binds only folder_item_id for project folders', () => {
		expect(buildContentFolderScopePatch(PROJECT_FOLDER)).toEqual({
			folder_item_id: PROJECT_FOLDER,
		});
	});

	it('clears project and company for regular user folders', () => {
		expect(buildContentFolderScopePatch('my-folder-1')).toEqual({
			folder_item_id: 'my-folder-1',
			project_id: null,
			company_id: null,
		});
	});
});

describe('collectDesktopFileParentScopeChanges', () => {
	it('returns file ids whose parent folder changed', () => {
		const prev = [file('doc-1', PROJECT_FOLDER), file('doc-2', 'folder-a')];
		const next = [file('doc-1', 'folder-b'), file('doc-2', 'folder-a')];

		expect(collectDesktopFileParentScopeChanges(prev, next)).toEqual([
			{ contentId: 'doc-1', parentId: 'folder-b' },
		]);
	});

	it('detects lift to desktop root', () => {
		const prev = [file('doc-1', PROJECT_FOLDER)];
		const next = [file('doc-1', undefined)];

		expect(collectDesktopFileParentScopeChanges(prev, next)).toEqual([
			{ contentId: 'doc-1', parentId: undefined },
		]);
	});

	it('ignores apps and unchanged files', () => {
		const prev: DesktopItem[] = [
			{ id: 'app-1', name: 'App', type: 'app', position: { x: 0, y: 0 } },
			file('doc-1', 'folder-a'),
		];
		const next: DesktopItem[] = [
			{ id: 'app-1', name: 'App', type: 'app', position: { x: 0, y: 0 } },
			file('doc-1', 'folder-a'),
		];

		expect(collectDesktopFileParentScopeChanges(prev, next)).toEqual([]);
	});
});
