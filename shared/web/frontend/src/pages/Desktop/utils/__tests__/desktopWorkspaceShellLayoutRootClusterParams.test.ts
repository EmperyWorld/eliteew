/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23 lock: shell layout root params pass-through builder.
 *
 * Related:
 * - utils/desktopWorkspaceShellLayoutRootClusterParams.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { buildDesktopWorkspaceShellLayoutRootClusterParams } from '../desktopWorkspaceShellLayoutRootClusterParams';

describe('buildDesktopWorkspaceShellLayoutRootClusterParams (Wave 23)', () => {
	it('returns the same root cluster fields', () => {
		const openVoiceCommandCenter = vi.fn();
		const params = buildDesktopWorkspaceShellLayoutRootClusterParams({
			openVoiceCommandCenter,
			t: vi.fn() as never,
			workspaceShellCss: '',
			desktopAreaRef: { current: null },
			effectiveTheme: 'dark',
			desktopMainSurfaceStyle: {},
			isDraggingIcon: false,
			groupDragState: null as never,
			desktopWindowStyle: 'flat' as never,
			shellSettingsBridge: {} as never,
			desktopUiScale: 1,
			hasOpenStudioGUWindow: false,
			activeVirtualDesktopId: 'd1',
			activeVirtualDesktopName: 'Main',
		});

		expect(params.openVoiceCommandCenter).toBe(openVoiceCommandCenter);
		expect(params.activeVirtualDesktopId).toBe('d1');
		expect(Object.keys(params)).toHaveLength(14);
	});
});
