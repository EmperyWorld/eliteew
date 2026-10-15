/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 20 composition lock: Settings Integration Bundle delegates to ClusterInput.
 *
 * Invariants:
 * - Bundle is the TailCluster public entry; runtime equals ClusterInput.
 *
 * Related:
 * - hooks/useDesktopWorkspaceSettingsIntegrationBundle.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const clusterInput = vi.hoisted(() =>
	vi.fn(() => ({
		shellClusterRest: { activeTab: 'shell' },
		surfaceChromeBundleInput: { accentRgb: '9,9,9' },
		mainSurfaceWallpaper: '#fff',
		activeVirtualDesktopShell: { id: 'd1', name: 'Main' },
		settingsCenterBridge: {},
		workspaceProfilesShellContext: {},
	}))
);

vi.mock('../useDesktopWorkspaceVoiceSettingsCenterClusterInput', () => ({
	useDesktopWorkspaceVoiceSettingsCenterClusterInput: clusterInput,
}));

import { useDesktopWorkspaceSettingsIntegrationBundle } from '../useDesktopWorkspaceSettingsIntegrationBundle';

describe('useDesktopWorkspaceSettingsIntegrationBundle (Wave 20)', () => {
	it('forwards sources to ClusterInput and returns facade composition', () => {
		const sources = { virtualDesktops: { wallpaper: '#111' } } as never;
		const { result } = renderHook(() =>
			useDesktopWorkspaceSettingsIntegrationBundle(sources)
		);

		expect(clusterInput).toHaveBeenCalledWith(sources);
		expect(result.current.shellClusterRest).toEqual({ activeTab: 'shell' });
		expect(result.current.surfaceChromeBundleInput).toEqual({
			accentRgb: '9,9,9',
		});
		expect(result.current.mainSurfaceWallpaper).toBe('#fff');
	});
});
