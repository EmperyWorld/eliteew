/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hook regression: hydrate-time stacked icon sanitizer commits reflowed positions and persists them.
 *
 * Invariants:
 * - Sanitize runs once per items fingerprint until positions change.
 *
 * Related:
 * - `useDesktopWorkspaceIconInteractions.ts`, `desktopIconPositionSanitizer.ts`
 */
import { renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { useDesktopWorkspaceIconInteractions } from '../useDesktopWorkspaceIconInteractions';

const toastInfo = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
	toast: {
		info: toastInfo,
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../utils/desktopSnapGeometry', () => ({
	readDesktopWorkArea: () => ({ width: 1600, height: 900 }),
}));

const DESKTOP_ICONS_REFLOW_TOAST_SESSION_KEY =
	'eliteew.desktop.icons-reflow-toast-shown';

function stackedRoot(id: string, name: string): DesktopItem {
	return {
		id,
		name,
		type: 'app',
		position: { x: 20, y: 20 },
	};
}

function minimalIconInteractionParams(
	overrides: Partial<
		Parameters<typeof useDesktopWorkspaceIconInteractions>[0]
	> = {}
) {
	const noop = () => {};
	return {
		items: [] as DesktopItem[],
		installedAppIds: new Set<string>(),
		desktopAreaRef: createRef<HTMLElement | null>(),
		iconSize: 'medium' as const,
		gridStepKey: 'medium' as const,
		commitItems: noop,
		updateItemPosition: noop,
		selected: new Set<string>(),
		setSelected: noop,
		selectedSyncRef: { current: new Set<string>() },
		setIsDraggingIcon: noop,
		setRenamingId: noop,
		clipboard: [],
		clipboardAction: null,
		setCtx: noop,
		setContextMenuType: noop,
		setContextMenuPosition: noop,
		setShowEnhancedContextMenu: noop,
		...overrides,
	};
}

describe('useDesktopWorkspaceIconInteractions hydrate sanitize', () => {
	beforeEach(() => {
		toastInfo.mockClear();
		sessionStorage.clear();
	});

	it('commits and persists distinct positions when icons load stacked at default anchor', async () => {
		const commitItems = vi.fn();
		const updateItemPosition = vi.fn();
		const items = [
			stackedRoot('a', 'Alpha'),
			stackedRoot('b', 'Beta'),
			stackedRoot('c', 'Gamma'),
		];
		const installedAppIds = new Set(items.map((item) => item.id));

		renderHook(() =>
			useDesktopWorkspaceIconInteractions(
				minimalIconInteractionParams({
					items,
					installedAppIds,
					commitItems,
					updateItemPosition,
				})
			)
		);

		await waitFor(() => {
			expect(commitItems).toHaveBeenCalled();
		});

		const nextItems = commitItems.mock.calls.at(-1)?.[0] as DesktopItem[];
		const keys = new Set(
			nextItems.map((item) => `${item.position.x},${item.position.y}`)
		);
		expect(keys.size).toBe(3);
		expect(updateItemPosition).toHaveBeenCalledTimes(2);
		expect(toastInfo).toHaveBeenCalledTimes(1);
		expect(toastInfo).toHaveBeenCalledWith(
			'workspace.iconsReflowOnHydrateToast'
		);
		expect(sessionStorage.getItem(DESKTOP_ICONS_REFLOW_TOAST_SESSION_KEY)).toBe(
			'1'
		);
	});

	it('shows reflow toast only once per browser session', async () => {
		const commitItems = vi.fn();
		const items = [stackedRoot('a', 'Alpha'), stackedRoot('b', 'Beta')];
		const installedAppIds = new Set(items.map((item) => item.id));

		renderHook(() =>
			useDesktopWorkspaceIconInteractions(
				minimalIconInteractionParams({
					items,
					installedAppIds,
					commitItems,
				})
			)
		);

		await waitFor(() => {
			expect(toastInfo).toHaveBeenCalledTimes(1);
		});

		toastInfo.mockClear();
		sessionStorage.setItem(DESKTOP_ICONS_REFLOW_TOAST_SESSION_KEY, '1');

		renderHook(() =>
			useDesktopWorkspaceIconInteractions(
				minimalIconInteractionParams({
					items,
					installedAppIds,
					commitItems,
				})
			)
		);

		await waitFor(() => {
			expect(commitItems).toHaveBeenCalled();
		});
		expect(toastInfo).not.toHaveBeenCalled();
	});
});
