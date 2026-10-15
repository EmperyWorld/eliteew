/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for Notification Hub prefs persist helper error path.
 *
 * Invariants:
 * - PATCH failure invokes revert, toast, and structured debug log.
 *
 * Related:
 * - ../quickSettings/useNotificationHubPrefsPersist.ts
 */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const updatePreferencesMock = vi.fn();
const refreshMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/services/profileService', () => ({
	updatePreferences: (...args: unknown[]) => updatePreferencesMock(...args),
}));

vi.mock('@/contexts/UserPreferencesAppContext', () => ({
	useUserPreferencesApp: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({
	toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

import { useNotificationHubPrefsPersist } from '../quickSettings/useNotificationHubPrefsPersist';

describe('useNotificationHubPrefsPersist', () => {
	beforeEach(() => {
		updatePreferencesMock.mockReset();
		refreshMock.mockReset();
		toastErrorMock.mockReset();
	});

	it('refreshes preferences on success', async () => {
		const updated = { notifications: { desktop_sound_enabled: false } };
		updatePreferencesMock.mockResolvedValue(updated);

		const { result } = renderHook(() => useNotificationHubPrefsPersist());
		let ok = false;
		await act(async () => {
			ok = await result.current.persistPreferences({
				notifications: { desktop_sound_enabled: false },
			});
		});

		expect(ok).toBe(true);
		expect(refreshMock).toHaveBeenCalledWith(updated);
		expect(toastErrorMock).not.toHaveBeenCalled();
	});

	it('reverts and toasts on PATCH failure', async () => {
		updatePreferencesMock.mockRejectedValue(new Error('network'));
		const revert = vi.fn();
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

		const { result } = renderHook(() => useNotificationHubPrefsPersist());
		let ok = true;
		await act(async () => {
			ok = await result.current.persistPreferences(
				{ notifications: { desktop_do_not_disturb: true } },
				{ revert }
			);
		});

		expect(ok).toBe(false);
		expect(revert).toHaveBeenCalledTimes(1);
		expect(toastErrorMock).toHaveBeenCalledWith('toastSaveFailed');
		expect(debugSpy).toHaveBeenCalledWith(
			'[STEP] notification_hub_prefs_save_fail',
			expect.objectContaining({
				patch: { notifications: { desktop_do_not_disturb: true } },
			})
		);
		debugSpy.mockRestore();
	});
});
