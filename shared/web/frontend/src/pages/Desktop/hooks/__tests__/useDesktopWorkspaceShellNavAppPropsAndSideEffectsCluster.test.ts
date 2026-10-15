/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for T34 nav / app-props / side-effects cluster wiring.
 *
 * Invariants:
 * - postNav receives openUgsDesktopApp from navigation bridge; app props receive onNavigate + openContentManager.
 *
 * Related:
 * - hooks/useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster.ts
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const launchHostCluster = vi.hoisted(() => vi.fn());
const navigationBridge = vi.hoisted(() =>
	vi.fn(() => ({
		openUgsDesktopApp: vi.fn(),
		onNavigate: vi.fn(),
		openVoiceCommandCenter: vi.fn(),
	}))
);
const openContentManagerHook = vi.hoisted(() =>
	vi.fn(() => ({ openContentManager: vi.fn() }))
);
const appPropsValueHook = vi.hoisted(() => vi.fn(() => ({ theme: 'dark' })));
const postNavCluster = vi.hoisted(() => vi.fn());
const openAppInputCluster = vi.hoisted(() => vi.fn());

vi.mock('../useDesktopWorkspaceShellLaunchHostEffectsCluster', () => ({
	useDesktopWorkspaceShellLaunchHostEffectsCluster: launchHostCluster,
}));
vi.mock('../useDesktopWorkspaceShellNavigationBridge', () => ({
	useDesktopWorkspaceShellNavigationBridge: navigationBridge,
}));
vi.mock('../useDesktopWorkspaceOpenContentManager', () => ({
	useDesktopWorkspaceOpenContentManager: openContentManagerHook,
}));
vi.mock('../useDesktopWorkspaceAppPropsValue', () => ({
	useDesktopWorkspaceAppPropsValue: appPropsValueHook,
}));
vi.mock('../useDesktopWorkspaceShellPostNavEffectsFlatCluster', () => ({
	useDesktopWorkspaceShellPostNavEffectsFlatCluster: postNavCluster,
}));
vi.mock('../useDesktopWorkspaceOpenAppAndInputSurfacesCluster', () => ({
	useDesktopWorkspaceOpenAppAndInputSurfacesCluster: openAppInputCluster,
}));

import { useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster } from '../useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster';

describe('useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('wires navigation outputs into app props and post-nav cluster', () => {
		const openUgsDesktopApp = vi.fn();
		const onNavigate = vi.fn();
		const openContentManager = vi.fn();
		navigationBridge.mockReturnValue({
			openUgsDesktopApp,
			onNavigate,
			openVoiceCommandCenter: vi.fn(),
		});
		openContentManagerHook.mockReturnValue({ openContentManager });

		const launchHost = { handleOpenWindow: vi.fn() };
		const navigation = {
			handleOpenWindow: vi.fn(),
			itemsRef: { current: [] },
			canOpenUnifiedAdmin: false,
			setCurrentPage: vi.fn(),
		};
		const appProps = {
			appPropsValueBase: {},
			desktopEmbeddedAppTheme: 'dark',
			desktopItems: [],
			openDesktopItem: vi.fn(),
			liftDesktopItemsToRoot: vi.fn(),
			liftDesktopItemsOneLevel: vi.fn(),
			moveDesktopNestedItemsToFolder: vi.fn(),
			renameDesktopItem: vi.fn(),
			deleteDesktopItems: vi.fn(),
		};
		const postNav = {
			items: [],
			installedApps: [],
			installedAppIds: new Set<string>(),
			handleOpenWindow: vi.fn(),
			currentPage: 'desktop',
			setCurrentPage: vi.fn(),
			isSyncing: false,
			storageError: null,
			notifyDesktop: vi.fn(),
			windows: [],
			closeWindow: vi.fn(),
		};
		const openAppInput = { items: [], handleOpenWindow: vi.fn() };

		renderHook(() =>
			useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster({
				launchHost: launchHost as never,
				navigation: navigation as never,
				appProps: appProps as never,
				postNav: postNav as never,
				openAppInput: openAppInput as never,
			})
		);

		expect(launchHostCluster).toHaveBeenCalledWith(launchHost);
		expect(navigationBridge).toHaveBeenCalledWith(navigation);
		expect(openContentManagerHook).toHaveBeenCalledWith({
			itemsRef: navigation.itemsRef,
			handleOpenWindow: navigation.handleOpenWindow,
		});
		expect(appPropsValueHook).toHaveBeenCalledWith(
			expect.objectContaining({ onNavigate, openContentManager })
		);
		expect(postNavCluster).toHaveBeenCalledWith(
			expect.objectContaining({ ...postNav, openUgsDesktopApp })
		);
		expect(openAppInputCluster).toHaveBeenCalledWith(openAppInput);
	});
});
