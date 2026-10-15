import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	canMoveDesktopItemIntoFolder,
	buildDesktopFolderPathChain,
	buildDesktopFolderTreeNodes,
	desktopFolderDescendantIds,
	filterAndSortDesktopChildItems,
	FOLDER_WINDOW_ROOT_ID,
	getDesktopChildItems,
	isDesktopSystemFolder,
	liftDesktopItemsOneLevel,
	liftDesktopItemsToRoot,
	collectDesktopDeleteIds,
	listValidNestedMoveTargetFolders,
	moveDesktopItemsIntoFolder,
	moveDesktopItemsIntoFolderWithReport,
	removeDesktopItemsByIds,
	wouldCreateDesktopFolderCycle,
} from '../desktopItemTree';

function folder(id: string, parentId?: string): DesktopItem {
	return {
		id,
		name: id,
		type: 'folder',
		position: { x: 0, y: 0 },
		parentId,
	};
}

function file(id: string, parentId?: string): DesktopItem {
	return {
		id,
		name: `${id}.md`,
		type: 'file',
		position: { x: 0, y: 0 },
		parentId,
		fileType: 'text/markdown',
	};
}

describe('desktopItemTree', () => {
	it('lists direct children by parentId', () => {
		const items = [folder('root'), folder('child', 'root'), file('a', 'root')];
		expect(
			getDesktopChildItems(items, 'root')
				.map((i) => i.id)
				.sort()
		).toEqual(['a', 'child']);
	});

	it('detects system folders', () => {
		expect(isDesktopSystemFolder(folder('documents'))).toBe(true);
		expect(isDesktopSystemFolder(folder('my-folder'))).toBe(false);
	});

	it('blocks nesting system folders', () => {
		const items = [folder('documents'), folder('user')];
		expect(
			canMoveDesktopItemIntoFolder(items, folder('documents'), folder('user'))
		).toBe(false);
	});

	it('detects folder cycles', () => {
		const items = [folder('a'), folder('b', 'a'), folder('c', 'b')];
		expect(wouldCreateDesktopFolderCycle(items, 'a', 'c')).toBe(true);
		expect(desktopFolderDescendantIds(items, 'a').has('c')).toBe(true);
	});

	it('allows folder into folder when acyclic', () => {
		const items = [folder('a'), folder('b'), folder('c', 'b')];
		expect(canMoveDesktopItemIntoFolder(items, folder('a'), folder('b'))).toBe(
			true
		);
	});

	it('filters and sorts nested children for folder window', () => {
		const items = [
			folder('parent'),
			file('zebra', 'parent'),
			folder('alpha', 'parent'),
			file('other', 'root'),
		];
		expect(
			filterAndSortDesktopChildItems(items, 'parent', { search: 'ze' }).map(
				(i) => i.id
			)
		).toEqual(['zebra']);
		expect(
			filterAndSortDesktopChildItems(items, 'parent', { sortBy: 'name' }).map(
				(i) => i.id
			)
		).toEqual(['alpha', 'zebra']);
	});

	it('builds folder tree and path with root section', () => {
		const items = [
			folder('root-a'),
			folder('child', 'root-a'),
			folder('root-b'),
		];
		const tree = buildDesktopFolderTreeNodes(items);
		expect(tree.map((n) => n.id).sort()).toEqual(['root-a', 'root-b']);
		expect(tree.find((n) => n.id === 'root-a')?.children[0]?.id).toBe('child');
		const path = buildDesktopFolderPathChain(items, 'child', 'Корневой раздел');
		expect(path.map((p) => p.name)).toEqual([
			'Корневой раздел',
			'root-a',
			'child',
		]);
		expect(FOLDER_WINDOW_ROOT_ID).toBe('unfiled');
	});

	it('lifts nested items to root or one level up', () => {
		const items = [
			folder('outer'),
			folder('inner', 'outer'),
			file('doc.md', 'inner'),
			file('root.md'),
		];
		const toRoot = liftDesktopItemsToRoot(items, ['doc.md']);
		expect(toRoot.find((i) => i.id === 'doc.md')?.parentId).toBeUndefined();
		const oneUp = liftDesktopItemsOneLevel(items, ['doc.md'], 'inner');
		expect(oneUp.find((i) => i.id === 'doc.md')?.parentId).toBe('outer');
	});

	it('moves nested items into another folder or root', () => {
		const items = [
			folder('outer'),
			folder('inner', 'outer'),
			folder('sibling'),
			file('doc.md', 'inner'),
		];
		const intoSibling = moveDesktopItemsIntoFolder(
			items,
			['doc.md'],
			'sibling'
		);
		expect(intoSibling.find((i) => i.id === 'doc.md')?.parentId).toBe(
			'sibling'
		);
		const toRoot = moveDesktopItemsIntoFolder(
			items,
			['doc.md'],
			FOLDER_WINDOW_ROOT_ID
		);
		expect(toRoot.find((i) => i.id === 'doc.md')?.parentId).toBeUndefined();
		const blocked = moveDesktopItemsIntoFolder(items, ['outer'], 'inner');
		expect(blocked).toBe(items);
	});

	it('reports root to folder to nested-folder movement and skipped cycle entries', () => {
		const items = [
			folder('outer'),
			folder('inner', 'outer'),
			folder('sibling'),
			file('root-doc'),
			file('nested-doc', 'inner'),
		];

		const intoOuter = moveDesktopItemsIntoFolderWithReport(
			items,
			['root-doc'],
			'outer'
		);
		expect(intoOuter.movedIds).toEqual(['root-doc']);
		expect(intoOuter.skippedIds).toEqual([]);
		expect(intoOuter.items.find((i) => i.id === 'root-doc')?.parentId).toBe(
			'outer'
		);

		const intoNested = moveDesktopItemsIntoFolderWithReport(
			intoOuter.items,
			['root-doc', 'outer'],
			'inner'
		);
		expect(intoNested.movedIds).toEqual(['root-doc']);
		expect(intoNested.skippedIds).toEqual(['outer']);
		expect(intoNested.items.find((i) => i.id === 'root-doc')?.parentId).toBe(
			'inner'
		);
	});

	it('lists valid nested move targets excluding cycles and self', () => {
		const items = [
			folder('outer'),
			folder('inner', 'outer'),
			folder('sibling'),
			file('doc.md', 'inner'),
		];
		expect(
			listValidNestedMoveTargetFolders(items, ['doc.md']).map((row) => row.id)
		).toEqual(['inner', 'outer', 'sibling']);
		expect(
			listValidNestedMoveTargetFolders(items, ['outer']).map((row) => row.id)
		).toEqual(['sibling']);
		expect(
			listValidNestedMoveTargetFolders(items, ['inner']).map((row) => row.id)
		).toEqual(['outer', 'sibling']);
	});

	it('collects delete ids including folder descendants', () => {
		const items = [
			folder('outer'),
			folder('inner', 'outer'),
			file('doc.md', 'inner'),
			file('root.md'),
		];
		const ids = collectDesktopDeleteIds(items, ['outer']);
		expect([...ids].sort()).toEqual(['doc.md', 'inner', 'outer']);
		const next = removeDesktopItemsByIds(items, ids);
		expect(next.map((row) => row.id)).toEqual(['root.md']);
		expect(collectDesktopDeleteIds(items, ['documents'])).toEqual(new Set());
	});
});
