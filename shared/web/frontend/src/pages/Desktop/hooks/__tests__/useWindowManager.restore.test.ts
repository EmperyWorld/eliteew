/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Restore-path tests for desktop window manager snapshots.
 *
 * Invariants:
 * - Persisted z-order is restored intentionally; focus order should not drift after F5.
 *
 * Related:
 * - src/pages/Desktop/hooks/useWindowManager.ts
 * - src/pages/Desktop/hooks/useDesktopShellWindowPersistence.ts
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWindowManager } from '../useWindowManager';
import type {
	DesktopItem,
	PersistedWindowState,
} from '../../types/desktop.types';

vi.mock('../../utils/preloadDesktopApp', () => ({
	preloadDesktopApp: vi.fn(),
	preloadDesktopApps: vi.fn(async () => undefined),
}));

const appItem: DesktopItem = {
	id: 'app-ugs',
	name: 'UGS',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'UGS',
};

function snapshot(title: string, zIndex: number): PersistedWindowState {
	return {
		type: 'app',
		title,
		path: [],
		position: { x: 10 * zIndex, y: 20 },
		size: { width: 600, height: 400 },
		isMinimized: false,
		isMaximized: false,
		zIndex,
		appComponent: 'UGS',
	};
}

describe('useWindowManager restoreWindows', () => {
	it('restores persisted z-index values', async () => {
		const { result } = renderHook(() => useWindowManager());

		result.current.restoreWindows(
			[snapshot('Back window', 3), snapshot('Front window', 19)],
			[appItem]
		);

		await waitFor(() => {
			expect(result.current.windows).toHaveLength(2);
		});

		expect(result.current.windows.map((window) => window.zIndex)).toEqual([
			3, 19,
		]);
	});

	it('reconciles live window ids instead of appending restore ids onto orphans', async () => {
		const addWindowToDesktop = vi.fn();
		const moveWindowToDesktop = vi.fn();
		const reconcileWindowMembership = vi.fn();
		const { result } = renderHook(() =>
			useWindowManager(
				addWindowToDesktop,
				undefined,
				moveWindowToDesktop,
				true,
				0,
				reconcileWindowMembership
			)
		);

		result.current.restoreWindows(
			[
				snapshot('Back window', 3),
				{
					...snapshot('Front window', 19),
					desktopId: 'desktop-2',
				},
			],
			[appItem]
		);

		await waitFor(() => {
			expect(result.current.windows).toHaveLength(2);
		});

		expect(addWindowToDesktop).not.toHaveBeenCalled();
		expect(moveWindowToDesktop).not.toHaveBeenCalled();
		expect(reconcileWindowMembership).toHaveBeenCalledTimes(1);
		const [liveIds, assignments] =
			reconcileWindowMembership.mock.calls[0] ?? [];
		expect(liveIds).toEqual(result.current.windows.map((window) => window.id));
		expect(assignments).toEqual({
			[result.current.windows[1]?.id ?? '']: 'desktop-2',
		});
	});

	it('skips identical payload updates to avoid restored app feedback loops', () => {
		const { result } = renderHook(() => useWindowManager());

		act(() => {
			result.current.openWindow(appItem, {
				initialPayload: {
					ewaDesktopSessionId: 'sess-1',
					ewaDesktopPersonaId: 'tala',
				},
			});
		});

		const windowId = result.current.windows[0]?.id ?? '';
		expect(windowId).not.toBe('');
		const previousWindows = result.current.windows;
		const previousWindow = result.current.windows[0];

		act(() => {
			result.current.updateWindowPayload(windowId, {
				ewaDesktopSessionId: 'sess-1',
				ewaDesktopPersonaId: 'tala',
			});
		});

		expect(result.current.windows).toBe(previousWindows);
		expect(result.current.windows[0]).toBe(previousWindow);

		act(() => {
			result.current.updateWindowPayload(windowId, {
				ewaDesktopDisplayName: 'Тала',
			});
		});

		expect(result.current.windows[0]).not.toBe(previousWindow);
		expect(result.current.windows[0]?.initialPayload).toEqual(
			expect.objectContaining({
				ewaDesktopSessionId: 'sess-1',
				ewaDesktopPersonaId: 'tala',
				ewaDesktopDisplayName: 'Тала',
			})
		);
	});
});
