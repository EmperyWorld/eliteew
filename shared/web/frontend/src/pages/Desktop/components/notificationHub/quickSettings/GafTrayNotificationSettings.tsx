/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat tray notification toggles inside Notification Hub Quick Settings.
 *
 * Invariants:
 * - Profile prefs via shared persist helper; toggles disabled while saving.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx, useNotificationHubPrefsPersist.ts
 */

import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import type { GafNotificationPreferences } from '@/types/profile';
import { DEFAULT_GAF_NOTIFICATION_PREFERENCES } from '@/types/profile';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import {
	NH_QUICK_SETTINGS_PREF_ROW_CLASS,
	NH_QUICK_SETTINGS_PREF_ROW_LABEL_CLASS,
	NH_QUICK_SETTINGS_SECTION_DESC_CLASS,
	NH_QUICK_SETTINGS_SECTION_STACK_CLASS,
	NH_QUICK_SETTINGS_TOGGLE_ROW_CLASS,
	NH_SECTION_LABEL_NORMAL_CLASS,
	nhQuickSettingsToggleButtonClass,
} from '../notificationHubLayoutTokens';
import { NotificationHubSettingsLoading } from './NotificationHubSettingsLoading';
import type { NotificationHubPrefsPersistOptions } from './useNotificationHubPrefsPersist';

function mergeGafNotificationPrefs(
	raw: GafNotificationPreferences | undefined
): GafNotificationPreferences {
	const d = DEFAULT_GAF_NOTIFICATION_PREFERENCES;
	return {
		incoming_message: { ...d.incoming_message, ...raw?.incoming_message },
	};
}

export type GafTrayNotificationSettingsProps = {
	saving: boolean;
	persistPreferences: (
		patch: { notifications: { gaf: GafNotificationPreferences } },
		options?: NotificationHubPrefsPersistOptions
	) => Promise<boolean>;
};

export const GafTrayNotificationSettings: React.FC<GafTrayNotificationSettingsProps> =
	memo(({ saving, persistPreferences }) => {
		const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
		const preferencesApp = useUserPreferencesApp();
		const loading = preferencesApp?.loading ?? false;
		const [gaf, setGaf] = useState<GafNotificationPreferences>(() =>
			mergeGafNotificationPrefs(undefined)
		);

		useEffect(() => {
			const p = preferencesApp?.preferences;
			if (p?.notifications?.gaf) {
				setGaf(mergeGafNotificationPrefs(p.notifications.gaf));
			}
		}, [preferencesApp?.preferences]);

		const persist = async (next: GafNotificationPreferences) => {
			const prev = gaf;
			setGaf(next);
			await persistPreferences(
				{ notifications: { gaf: next } },
				{ revert: () => setGaf(prev) }
			);
		};

		const b = gaf.incoming_message;
		const toggle = (field: 'enabled' | 'in_app' | 'browser') => () => {
			const next = {
				...gaf,
				incoming_message: { ...b, [field]: !b[field] },
			};
			void persist(next);
		};
		const offLabel = t('toggle.off');
		const onLabel = t('toggle.on');
		const inAppLabel = t('toggle.inApp');
		const browserLabel = t('toggle.browserOs');

		if (loading) {
			return <NotificationHubSettingsLoading text={t('loading')} />;
		}

		return (
			<div className={NH_QUICK_SETTINGS_SECTION_STACK_CLASS} aria-busy={saving}>
				<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
					{t('gaf.sectionTitle')}
				</DesktopAppSectionLabel>
				<p className={NH_QUICK_SETTINGS_SECTION_DESC_CLASS}>
					{t('gaf.sectionDescription')}
				</p>
				<div className={NH_QUICK_SETTINGS_PREF_ROW_CLASS}>
					<p className={NH_QUICK_SETTINGS_PREF_ROW_LABEL_CLASS}>
						{t('gaf.incomingRowTitle')}
					</p>
					<div className={NH_QUICK_SETTINGS_TOGGLE_ROW_CLASS}>
						<DesktopChromeTooltip
							content={b.enabled ? onLabel : offLabel}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={b.enabled ? 'accent' : 'ghost'}
								className={nhQuickSettingsToggleButtonClass()}
								onClick={toggle('enabled')}
								disabled={saving}
							>
								{b.enabled ? onLabel : offLabel}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={inAppLabel}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={b.in_app ? 'accent' : 'ghost'}
								className={nhQuickSettingsToggleButtonClass()}
								onClick={toggle('in_app')}
								disabled={!b.enabled || saving}
							>
								{inAppLabel}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={browserLabel}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={b.browser ? 'accent' : 'ghost'}
								className={nhQuickSettingsToggleButtonClass()}
								onClick={toggle('browser')}
								disabled={!b.enabled || saving}
							>
								{browserLabel}
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</div>
				</div>
			</div>
		);
	});

GafTrayNotificationSettings.displayName = 'GafTrayNotificationSettings';
