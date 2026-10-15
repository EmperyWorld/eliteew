/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared profile PATCH helper for Notification Hub Quick Settings with visible failure UX.
 *
 * Invariants:
 * - On PATCH failure: optional revert callback, user toast, structured debug log — no silent drift.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx, GafTrayNotificationSettings.tsx, UgsTrayNotificationSettings.tsx
 */

import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import * as profileService from '@/services/profileService';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type NotificationHubPrefsPersistOptions = {
	revert?: () => void;
};

export function useNotificationHubPrefsPersist() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
	const preferencesApp = useUserPreferencesApp();
	const [saving, setSaving] = useState(false);

	const persistPreferences = useCallback(
		async (
			patch: Parameters<typeof profileService.updatePreferences>[0],
			options?: NotificationHubPrefsPersistOptions
		): Promise<boolean> => {
			setSaving(true);
			try {
				const updated = await profileService.updatePreferences(patch);
				await preferencesApp?.refresh?.(updated);
				return true;
			} catch (err) {
				console.debug('[STEP] notification_hub_prefs_save_fail', {
					patch,
					err,
				});
				options?.revert?.();
				toast.error(t('toastSaveFailed'));
				return false;
			} finally {
				setSaving(false);
			}
		},
		[preferencesApp, t]
	);

	return { saving, persistPreferences };
}
