/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for expansion launch actions extracted in T34.
 *
 * Invariants:
 * - openGafChatBySession ignores blank ids; openAppCollection resolves installed apps.
 *
 * Related:
 * - hooks/useDesktopWorkspaceExpansionLaunchActions.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { useDesktopWorkspaceExpansionLaunchActions } from '../useDesktopWorkspaceExpansionLaunchActions';

const baseItem = (id: string): DesktopItem =>
	({
		id,
		name: id,
		type: 'app',
		position: { x: 0, y: 0 },
	}) as DesktopItem;

describe('useDesktopWorkspaceExpansionLaunchActions', () => {
	it('openGafChatBySession trims chat id and opens GAF window', () => {
		const openDesktopAppByComponent = vi.fn();
		const handleOpenWindow = vi.fn();

		const { result } = renderHook(() =>
			useDesktopWorkspaceExpansionLaunchActions({
				items: [],
				installedApps: [],
				selected: new Set(),
				activeDesktopId: 'd1',
				activeDesktopWindow: null,
				windows: [],
				expansion: {
					workspaceProfiles: [],
					appCollections: [],
					contentShortcuts: [],
					assistantContextActions: [],
				},
				handleOpenWindow,
				openDesktopAppByComponent,
				switchToDesktop: vi.fn(),
				updateDesktopWallpaper: vi.fn(),
				recordRecentAppOnVirtualDesktop: vi.fn(),
				addRecentFile: vi.fn(),
				propertiesItem: null,
				setPropertiesItem: vi.fn(),
				t: ((key: string) => key) as never,
			})
		);

		result.current.openGafChatBySession('  chat-42  ');
		expect(openDesktopAppByComponent).toHaveBeenCalledWith('GAFChatApp', {
			initialPayload: { targetChatId: 'chat-42' },
		});
		result.current.openGafChatBySession('   ');
		expect(openDesktopAppByComponent).toHaveBeenCalledTimes(1);
	});

	it('openAppCollection opens apps from collection appIds', () => {
		const handleOpenWindow = vi.fn();
		const installed = baseItem('app-a');

		const { result } = renderHook(() =>
			useDesktopWorkspaceExpansionLaunchActions({
				items: [],
				installedApps: [installed],
				selected: new Set(),
				activeDesktopId: 'd1',
				activeDesktopWindow: null,
				windows: [],
				expansion: {
					workspaceProfiles: [],
					appCollections: [{ id: 'c1', name: 'C', appIds: ['app-a'] }],
					contentShortcuts: [],
					assistantContextActions: [],
				},
				handleOpenWindow,
				openDesktopAppByComponent: vi.fn(),
				switchToDesktop: vi.fn(),
				updateDesktopWallpaper: vi.fn(),
				recordRecentAppOnVirtualDesktop: vi.fn(),
				addRecentFile: vi.fn(),
				propertiesItem: null,
				setPropertiesItem: vi.fn(),
				t: ((key: string) => key) as never,
			})
		);

		result.current.openAppCollection('c1');
		expect(handleOpenWindow).toHaveBeenCalledWith(installed);
	});
});
