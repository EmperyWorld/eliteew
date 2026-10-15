/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the T32 derived layout bridge input assembler.
 *
 * Invariants:
 * - All three typed prop groups flatten into the derived handler params without field loss.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceShellLayoutDerivedInput.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { VirtualDesktop } from '../useVirtualDesktops';
import { useDesktopWorkspaceShellLayoutDerivedInput } from '../useDesktopWorkspaceShellLayoutDerivedInput';
import type { DesktopWorkspaceShellLayoutDerivedBridgeInput } from '../../types/desktopWorkspaceShellLayoutDerivedBridge.types';

function buildMinimalGroups(): DesktopWorkspaceShellLayoutDerivedBridgeInput {
	return {
		contextMenuAndOverlays: {
			setWindowContextMenu: vi.fn(),
			setShowShortcutsHelp: vi.fn(),
			setShowSessionInfoPanel: vi.fn(),
		},
		shellSettingsAndAdmin: {
			openShellSettings: vi.fn(),
			canOpenUnifiedAdmin: true,
			handleOpenWindow: vi.fn(),
			unifiedAdminDesktopItem: { id: 'admin', type: 'app' } as never,
		},
		virtualDesktopsState: {
			desktops: [
				{
					id: 'd1',
					name: 'Main',
					isActive: true,
					windows: [],
				} satisfies VirtualDesktop,
			],
			activeDesktopId: 'd1',
			createDesktop: vi.fn(),
			deleteDesktop: vi.fn(),
			switchToDesktop: vi.fn(),
			updateDesktopName: vi.fn(),
			workspaceProfiles: [],
			onOpenWorkspaceProfile: vi.fn(),
			vdDropHoverId: null,
		},
	};
}

describe('useDesktopWorkspaceShellLayoutDerivedInput', () => {
	it('flattens all three derived prop groups without field loss', () => {
		const groups = buildMinimalGroups();

		const { result } = renderHook(() =>
			useDesktopWorkspaceShellLayoutDerivedInput(groups)
		);

		expect(result.current.setWindowContextMenu).toBe(
			groups.contextMenuAndOverlays.setWindowContextMenu
		);
		expect(result.current.openShellSettings).toBe(
			groups.shellSettingsAndAdmin.openShellSettings
		);
		expect(result.current.canOpenUnifiedAdmin).toBe(true);
		expect(result.current.handleOpenWindow).toBe(
			groups.shellSettingsAndAdmin.handleOpenWindow
		);
		expect(result.current.desktops).toEqual(
			groups.virtualDesktopsState.desktops
		);
		expect(result.current.activeDesktopId).toBe('d1');
		expect(result.current.onOpenWorkspaceProfile).toBe(
			groups.virtualDesktopsState.onOpenWorkspaceProfile
		);
		expect(result.current.vdDropHoverId).toBeNull();
	});
});
