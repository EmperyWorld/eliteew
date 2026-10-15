/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest lock for CM explorer nested-folder resolution (desktop_items children).
 *
 * Invariants:
 * - Explorer + real parent → child folders; unfiled/catalog/all_files → empty.
 *
 * Related:
 * - contentManagerExplorerNestedFolders.ts
 */

import { describe, expect, it } from 'vitest';
import type { DesktopItemResponse } from '../../Desktop/services/desktopApi';
import { resolveContentManagerExplorerNestedFolders } from './contentManagerExplorerNestedFolders';

type DesktopFolderWireItem = DesktopItemResponse & {
	parent_item_id?: string | null;
};

function folder(
	partial: Partial<DesktopFolderWireItem> &
		Pick<DesktopFolderWireItem, 'item_id' | 'name'>
): DesktopFolderWireItem {
	return {
		...partial,
		id: partial.id ?? `uuid-${partial.item_id}`,
		item_id: partial.item_id,
		item_type: 'FOLDER',
		name: partial.name,
		position: { x: 0, y: 0 },
		is_system: partial.is_system ?? false,
		parent_id: partial.parent_id ?? null,
		parent_item_id: partial.parent_item_id ?? null,
	} as DesktopFolderWireItem;
}

describe('resolveContentManagerExplorerNestedFolders', () => {
	const ewa = folder({
		id: 'uuid-ewa',
		item_id: 'ewa_file',
		name: 'EwaFile',
		is_system: true,
		parent_id: null,
		parent_item_id: null,
	});
	const task = folder({
		id: 'uuid-task',
		item_id: 'ewa-task-abc',
		name: 'Task ABC',
		parent_id: 'uuid-ewa',
		parent_item_id: 'ewa_file',
	});
	const other = folder({
		id: 'uuid-docs',
		item_id: 'documents',
		name: 'Documents',
		is_system: true,
		parent_id: null,
		parent_item_id: null,
	});

	it('returns child folders for explorer parent by parent_item_id', () => {
		const rows = resolveContentManagerExplorerNestedFolders(
			[ewa, task, other],
			'explorer',
			'ewa_file'
		);
		expect(rows.map((r) => r.item_id)).toEqual(['ewa-task-abc']);
	});

	it('returns empty for unfiled / catalog / all_files', () => {
		expect(
			resolveContentManagerExplorerNestedFolders(
				[ewa, task],
				'explorer',
				'unfiled'
			)
		).toEqual([]);
		expect(
			resolveContentManagerExplorerNestedFolders(
				[ewa, task],
				'catalog',
				'ewa_file'
			)
		).toEqual([]);
		expect(
			resolveContentManagerExplorerNestedFolders(
				[ewa, task],
				'all_files',
				'ewa_file'
			)
		).toEqual([]);
	});

	it('filters by search name', () => {
		const rows = resolveContentManagerExplorerNestedFolders(
			[ewa, task],
			'explorer',
			'ewa_file',
			{ search: 'task' }
		);
		expect(rows).toHaveLength(1);
		expect(
			resolveContentManagerExplorerNestedFolders(
				[ewa, task],
				'explorer',
				'ewa_file',
				{ search: 'zzz' }
			)
		).toEqual([]);
	});
});
