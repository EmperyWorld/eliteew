/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS tray notification toggles inside Notification Hub Quick Settings.
 *
 * Invariants:
 * - Profile prefs via shared persist helper; toggles disabled while saving.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx, useNotificationHubPrefsPersist.ts
 */

import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import type { UgsNotificationPreferences } from '@/types/profile';
import { DEFAULT_UGS_NOTIFICATION_PREFERENCES } from '@/types/profile';
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

function mergeUgsNotificationPrefs(
	raw: UgsNotificationPreferences | undefined
): UgsNotificationPreferences {
	const d = DEFAULT_UGS_NOTIFICATION_PREFERENCES;
	return {
		task_completed: { ...d.task_completed, ...raw?.task_completed },
		task_queued: { ...d.task_queued, ...raw?.task_queued },
		task_started: { ...d.task_started, ...raw?.task_started },
	};
}

export type UgsTrayNotificationSettingsProps = {
	saving: boolean;
	persistPreferences: (
		patch: { notifications: { ugs: UgsNotificationPreferences } },
		options?: NotificationHubPrefsPersistOptions
	) => Promise<boolean>;
};

export const UgsTrayNotificationSettings: React.FC<UgsTrayNotificationSettingsProps> =
	memo(({ saving, persistPreferences }) => {
		const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
		const preferencesApp = useUserPreferencesApp();
		const loading = preferencesApp?.loading ?? false;
		const [ugs, setUgs] = useState<UgsNotificationPreferences>(() =>
			mergeUgsNotificationPrefs(undefined)
		);

		useEffect(() => {
			const p = preferencesApp?.preferences;
			if (p?.notifications?.ugs) {
				setUgs(mergeUgsNotificationPrefs(p.notifications.ugs));
			}
		}, [preferencesApp?.preferences]);

		const persist = async (next: UgsNotificationPreferences) => {
			const prev = ugs;
			setUgs(next);
			await persistPreferences(
				{ notifications: { ugs: next } },
				{ revert: () => setUgs(prev) }
			);
		};

		const row = (labelKey: keyof UgsNotificationPreferences) => {
			const key = labelKey;
			const label = t(`ugs.rows.${key}`);
			const b = ugs[key];
			const toggle = (field: 'enabled' | 'in_app' | 'browser') => () => {
				const next = {
					...ugs,
					[key]: { ...b, [field]: !b[field] },
				};
				void persist(next);
			};
			const offLabel = t('toggle.off');
			const onLabel = t('toggle.on');
			const inAppLabel = t('toggle.inApp');
			const browserLabel = t('toggle.browserOs');
			return (
				<div key={key} className={NH_QUICK_SETTINGS_PREF_ROW_CLASS}>
					<p className={NH_QUICK_SETTINGS_PREF_ROW_LABEL_CLASS}>{label}</p>
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
			);
		};

		if (loading) {
			return <NotificationHubSettingsLoading text={t('loading')} />;
		}

		return (
			<div className={NH_QUICK_SETTINGS_SECTION_STACK_CLASS} aria-busy={saving}>
				<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
					{t('ugs.sectionTitle')}
				</DesktopAppSectionLabel>
				<p className={NH_QUICK_SETTINGS_SECTION_DESC_CLASS}>
					{t('ugs.sectionDescription')}
				</p>
				{row('task_completed')}
				{row('task_queued')}
				{row('task_started')}
			</div>
		);
	});

UgsTrayNotificationSettings.displayName = 'UgsTrayNotificationSettings';
