/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for DesktopAppPropsContext value assembly used by embedded desktop apps.
 *
 * Invariants:
 * - Nested folder window callbacks keep pointing at extracted desktop item operations.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceAppPropsValue.ts
 * - src/pages/Desktop/hooks/useDesktopWorkspaceItemOperations.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { useDesktopWorkspaceAppPropsValue } from '../useDesktopWorkspaceAppPropsValue';

function desktopItem(id: string): DesktopItem {
	return {
		id,
		name: id,
		type: 'folder',
		position: { x: 0, y: 0 },
	};
}

describe('useDesktopWorkspaceAppPropsValue', () => {
	it('forwards nested folder item operations for app-props callers', () => {
		const moveDesktopNestedItemsToFolder = vi.fn();
		const liftDesktopItemsOneLevel = vi.fn();
		const createMarkdownFileInFolder = vi.fn();
		const openNewFolderDialog = vi.fn();
		const openDesktopItemProperties = vi.fn();

		const { result } = renderHook(() =>
			useDesktopWorkspaceAppPropsValue({
				appPropsValueBase: {},
				desktopEmbeddedAppTheme: {
					primary: '#fff',
					secondary: '#ddd',
					background: '#000',
					surface: '#111',
					text: '#fff',
					accent: '#7dd3fc',
					success: '#22c55e',
					warning: '#f59e0b',
					error: '#ef4444',
					info: '#38bdf8',
				},
				onNavigate: vi.fn(),
				openContentManager: vi.fn(),
				desktopItems: [desktopItem('folder-a')],
				openDesktopItem: vi.fn(),
				liftDesktopItemsToRoot: vi.fn(),
				liftDesktopItemsOneLevel,
				moveDesktopNestedItemsToFolder,
				renameDesktopItem: vi.fn(),
				deleteDesktopItems: vi.fn(),
				openNewFolderDialog,
				createMarkdownFileInFolder,
				openEditFolderIconDialog: vi.fn(),
				openDesktopItemProperties,
			})
		);

		result.current.moveDesktopNestedItemsToFolder?.(['child-1'], 'folder-a');
		result.current.liftDesktopItemsOneLevel?.(['child-1'], 'folder-a');
		result.current.createMarkdownFileInFolder?.('folder-a');
		result.current.openNewFolderDialog?.('folder-a');
		result.current.openDesktopItemProperties?.(desktopItem('folder-a'));

		expect(moveDesktopNestedItemsToFolder).toHaveBeenCalledWith(
			['child-1'],
			'folder-a'
		);
		expect(liftDesktopItemsOneLevel).toHaveBeenCalledWith(
			['child-1'],
			'folder-a'
		);
		expect(createMarkdownFileInFolder).toHaveBeenCalledWith('folder-a');
		expect(openNewFolderDialog).toHaveBeenCalledWith('folder-a');
		expect(openDesktopItemProperties).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'folder-a' })
		);
	});
});
