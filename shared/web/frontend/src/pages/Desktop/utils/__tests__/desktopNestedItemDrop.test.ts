import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { relocateNestedDesktopItemsToRootAtPosition } from '../desktopNestedItemDrop';

function nestedFile(id: string, parentId: string): DesktopItem {
	return {
		id,
		name: `${id}.md`,
		type: 'file',
		position: { x: 0, y: 0 },
		parentId,
		fileType: 'text/markdown',
	};
}

describe('desktopNestedItemDrop', () => {
	it('clears parentId and assigns grid position for nested items', () => {
		const items = [
			nestedFile('doc', 'folder-a'),
			{
				id: 'folder-a',
				name: 'Folder A',
				type: 'folder' as const,
				position: { x: 100, y: 100 },
			},
		];
		const next = relocateNestedDesktopItemsToRootAtPosition(
			items,
			['doc'],
			{ x: 48, y: 48 },
			'medium',
			'medium'
		);
		const doc = next.find((row) => row.id === 'doc');
		expect(doc?.parentId).toBeUndefined();
		expect(doc?.position.x).toBeGreaterThanOrEqual(0);
		expect(doc?.position.y).toBeGreaterThanOrEqual(0);
	});

	it('ignores items already at desktop root', () => {
		const items = [
			{
				id: 'root-doc',
				name: 'root.md',
				type: 'file' as const,
				position: { x: 80, y: 80 },
				fileType: 'text/markdown',
			},
		];
		const next = relocateNestedDesktopItemsToRootAtPosition(
			items,
			['root-doc'],
			{ x: 48, y: 48 },
			'medium',
			'medium'
		);
		expect(next).toBe(items);
	});
});
