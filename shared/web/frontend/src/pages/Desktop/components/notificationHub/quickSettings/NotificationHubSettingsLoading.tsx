/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loading placeholder for Notification Hub Quick Settings blocks.
 *
 * Invariants:
 * - Exposes `role="status"` and `aria-busy` for assistive tech.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx
 */

import { useTranslation } from 'react-i18next';
import { NH_SETTINGS_LOADING_CLASS } from '../notificationHubLayoutTokens';

export function NotificationHubSettingsLoading({ text }: { text: string }) {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
	return (
		<p
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label={t('settingsLoadingAria')}
			className={NH_SETTINGS_LOADING_CLASS}
		>
			{text}
		</p>
	);
}
