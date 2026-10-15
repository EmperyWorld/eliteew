/**
 * @vitest-environment jsdom
 */
/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Group-drag preview must stay DOM-only (no displayItems remap each frame).
 *
 * Invariants:
 * - handleDrag updates sibling transform via data-desktop-icon-id; displayItems positions stay at rest.
 *
 * Related:
 * - useDesktopWorkspaceIconInteractions.ts
 */
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { useDesktopWorkspaceIconInteractions } from '../useDesktopWorkspaceIconInteractions';

vi.mock('sonner', () => ({
	toast: { info: vi.fn() },
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../utils/desktopSnapGeometry', () => ({
	readDesktopWorkArea: () => ({ width: 1600, height: 900 }),
}));

function rootIcon(id: string, x: number, y: number): DesktopItem {
	return {
		id,
		name: id,
		type: 'app',
		position: { x, y },
	};
}

describe('useDesktopWorkspaceIconInteractions group drag', () => {
	it('previews sibling icons via DOM transform without remapping displayItems', () => {
		const items = [
			rootIcon('a', 20, 20),
			rootIcon('b', 120, 20),
			rootIcon('c', 220, 20),
		];
		const installedAppIds = new Set(items.map((item) => item.id));
		const selected = new Set(['a', 'b']);
		const selectedSyncRef = { current: selected };

		const sibling = document.createElement('div');
		sibling.setAttribute('data-desktop-icon-id', 'b');
		document.body.appendChild(sibling);

		const { result } = renderHook(() =>
			useDesktopWorkspaceIconInteractions({
				items,
				installedAppIds,
				desktopAreaRef: createRef<HTMLElement | null>(),
				iconSize: 'medium',
				gridStepKey: 'medium',
				commitItems: vi.fn(),
				updateItemPosition: vi.fn(),
				selected,
				setSelected: vi.fn(),
				selectedSyncRef,
				setIsDraggingIcon: vi.fn(),
				setRenamingId: vi.fn(),
				clipboard: [],
				clipboardAction: null,
				setCtx: vi.fn(),
				setContextMenuType: vi.fn(),
				setContextMenuPosition: vi.fn(),
				setShowEnhancedContextMenu: vi.fn(),
			})
		);

		act(() => {
			result.current.handleDragStart('a');
		});
		expect(result.current.groupDragState?.anchorId).toBe('a');

		const beforeB = result.current.displayItems.find((item) => item.id === 'b');
		expect(beforeB?.position).toEqual({ x: 120, y: 20 });

		act(() => {
			result.current.handleDrag('a', 60, 40);
		});

		const afterB = result.current.displayItems.find((item) => item.id === 'b');
		expect(afterB?.position).toEqual({ x: 120, y: 20 });
		expect(sibling.style.transform).toBe('translate3d(40px, 20px, 0)');

		act(() => {
			result.current.handleDragEnd('a', 60, 40, { cancelled: true });
		});
		expect(sibling.style.transform).toBe('');
		expect(result.current.groupDragState).toBeNull();

		sibling.remove();
	});
});
