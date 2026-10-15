/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for shell settings scroll bridge (deep link from storage map).
 *
 * Invariants:
 * - Clears scroll target payload after handled navigation.
 *
 * Related:
 * - `useDesktopShellSettingsScrollBridge.ts`
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDesktopShellSettingsScrollBridge } from '../useDesktopShellSettingsScrollBridge';
import type { WindowState } from '../../types/desktop.types';

describe('useDesktopShellSettingsScrollBridge', () => {
	it('exposes pending scroll id and clears payload on handled', () => {
		const updateWindowPayload = vi.fn();
		const windows: WindowState[] = [
			{
				id: 'settings-win',
				appComponent: 'DesktopShellSettings',
				initialPayload: {
					shellSettingsScrollToElementId:
						'desktop-settings-field-shell_state-quiet_mode',
				},
			} as WindowState,
		];
		const base = { isOnline: true };

		const { result } = renderHook(() =>
			useDesktopShellSettingsScrollBridge(base, {
				windows,
				updateWindowPayload,
			})
		);

		expect(result.current.pendingShellScrollElementId).toBe(
			'desktop-settings-field-shell_state-quiet_mode'
		);
		expect(result.current.isOnline).toBe(true);

		result.current.onShellScrollHandled();
		expect(updateWindowPayload).toHaveBeenCalledWith('settings-win', {
			shellSettingsScrollToElementId: undefined,
		});
	});

	it('no-ops when DesktopShellSettings window is absent', () => {
		const updateWindowPayload = vi.fn();
		const { result } = renderHook(() =>
			useDesktopShellSettingsScrollBridge(
				{},
				{ windows: [], updateWindowPayload }
			)
		);

		expect(result.current.pendingShellScrollElementId).toBeNull();
		result.current.onShellScrollHandled();
		expect(updateWindowPayload).not.toHaveBeenCalled();
	});
});
