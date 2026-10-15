/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for Notification Hub Quick Settings (sound, GAF, UGS blocks).
 *
 * Invariants:
 * - Reads profile notification prefs from UserPreferencesAppContext (single source, no duplicate GET).
 * - Persist failures surface toast and revert optimistic UI via useNotificationHubPrefsPersist.
 *
 * Related:
 * - NotificationHubBody.tsx, quickSettings/*
 * - DesktopChromeTooltip.tsx
 */

import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import type { NotificationSourceKey } from '@/notifications/sourceMeta';
import { cn } from '@/utils/cn';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopNotificationSoundTheme } from '../../utils/notificationSound';
import {
	getDesktopNotificationSettings,
	normalizeDesktopSourceEnabled,
	normalizeDesktopSoundTheme,
	normalizeDesktopSourceThemes,
	playNotificationSound,
	playNotificationSoundForSourceThrottled,
	playNotificationSoundPreview,
	updateDesktopNotificationSettings,
} from '../../utils/notificationSound';
import {
	NH_QUICK_SETTINGS_ROOT_CLASS,
	NH_QUICK_SETTINGS_SECTION_CARD_CLASS,
} from './notificationHubLayoutTokens';
import { GafTrayNotificationSettings } from './quickSettings/GafTrayNotificationSettings';
import { NotificationHubNotifyTestPanel } from './quickSettings/NotificationHubNotifyTestPanel';
import { NotificationHubSettingsLoading } from './quickSettings/NotificationHubSettingsLoading';
import { NotificationHubSoundSettings } from './quickSettings/NotificationHubSoundSettings';
import { NotificationHubSourceSoundSettings } from './quickSettings/NotificationHubSourceSoundSettings';
import { UgsTrayNotificationSettings } from './quickSettings/UgsTrayNotificationSettings';
import { useNotificationHubPrefsPersist } from './quickSettings/useNotificationHubPrefsPersist';

export type NotificationHubQuickSettingsProps = {
	/** MobileAndroid embedded WebView — single-column settings grids. */
	embeddedMobileLayout?: boolean;
};

export const NotificationHubQuickSettings: React.FC<NotificationHubQuickSettingsProps> =
	memo(({ embeddedMobileLayout = false }) => {
		const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
		const preferencesApp = useUserPreferencesApp();
		const loading = preferencesApp?.loading ?? false;
		const { saving, persistPreferences } = useNotificationHubPrefsPersist();
		const [sound, setSound] = useState(
			getDesktopNotificationSettings().soundEnabled
		);
		const [doNotDisturb, setDoNotDisturb] = useState(
			getDesktopNotificationSettings().doNotDisturb
		);
		const [theme, setTheme] = useState<DesktopNotificationSoundTheme>(
			getDesktopNotificationSettings().soundTheme
		);
		const [sourceThemes, setSourceThemes] = useState(
			getDesktopNotificationSettings().soundThemeBySource
		);
		const [sourceEnabled, setSourceEnabled] = useState(
			getDesktopNotificationSettings().soundEnabledBySource
		);
		const [allSocketEvents, setAllSocketEvents] = useState(false);

		useEffect(() => {
			const p = preferencesApp?.preferences;
			if (!p?.notifications) return;
			const notif = p.notifications;
			const nextTheme = normalizeDesktopSoundTheme(notif.desktop_sound_theme);
			const nextSourceThemes = normalizeDesktopSourceThemes(
				notif.desktop_sound_theme_by_source
			);
			const nextSourceEnabled = normalizeDesktopSourceEnabled(
				notif.desktop_sound_enabled_by_source
			);
			const nextSound = notif.desktop_sound_enabled ?? true;
			const nextDnd = notif.desktop_do_not_disturb ?? false;
			const nextAllSocket =
				notif.desktop_notification_center_all_socket_events ?? false;
			setSound(nextSound);
			setDoNotDisturb(nextDnd);
			setTheme(nextTheme);
			setSourceThemes(nextSourceThemes);
			setSourceEnabled(nextSourceEnabled);
			setAllSocketEvents(nextAllSocket);
			updateDesktopNotificationSettings({
				soundEnabled: nextSound,
				doNotDisturb: nextDnd,
				soundTheme: nextTheme,
				soundThemeBySource: nextSourceThemes,
				soundEnabledBySource: nextSourceEnabled,
			});
		}, [preferencesApp?.preferences]);

		const persistSoundPrefs = async (next: {
			soundEnabled?: boolean;
			doNotDisturb?: boolean;
			soundTheme?: DesktopNotificationSoundTheme;
			soundThemeBySource?: Record<
				NotificationSourceKey,
				DesktopNotificationSoundTheme
			>;
			soundEnabledBySource?: Record<NotificationSourceKey, boolean>;
			allSocketEvents?: boolean;
		}) => {
			const prev = {
				sound,
				doNotDisturb,
				theme,
				sourceThemes,
				sourceEnabled,
				allSocketEvents,
			};
			await persistPreferences(
				{
					notifications: {
						desktop_sound_enabled: next.soundEnabled ?? sound,
						desktop_do_not_disturb: next.doNotDisturb ?? doNotDisturb,
						desktop_sound_theme: next.soundTheme ?? theme,
						desktop_sound_theme_by_source:
							next.soundThemeBySource ?? sourceThemes,
						desktop_sound_enabled_by_source:
							next.soundEnabledBySource ?? sourceEnabled,
						desktop_notification_center_all_socket_events:
							next.allSocketEvents ?? allSocketEvents,
					},
				},
				{
					revert: () => {
						setSound(prev.sound);
						setDoNotDisturb(prev.doNotDisturb);
						setTheme(prev.theme);
						setSourceThemes(prev.sourceThemes);
						setSourceEnabled(prev.sourceEnabled);
						setAllSocketEvents(prev.allSocketEvents);
						updateDesktopNotificationSettings({
							soundEnabled: prev.sound,
							doNotDisturb: prev.doNotDisturb,
							soundTheme: prev.theme,
							soundThemeBySource: prev.sourceThemes,
							soundEnabledBySource: prev.sourceEnabled,
						});
					},
				}
			);
		};

		const toggleSound = () => {
			const next = !sound;
			setSound(next);
			updateDesktopNotificationSettings({ soundEnabled: next });
			void persistSoundPrefs({ soundEnabled: next });
		};

		const toggleDnd = () => {
			const next = !doNotDisturb;
			setDoNotDisturb(next);
			updateDesktopNotificationSettings({ doNotDisturb: next });
			void persistSoundPrefs({ doNotDisturb: next });
		};

		const changeTheme = (value: DesktopNotificationSoundTheme) => {
			const normalized = normalizeDesktopSoundTheme(value);
			const nextSourceThemes = {
				...sourceThemes,
				default: normalized,
			};
			setTheme(normalized);
			setSourceThemes(nextSourceThemes);
			updateDesktopNotificationSettings({
				soundTheme: normalized,
				soundThemeBySource: nextSourceThemes,
			});
			void persistSoundPrefs({
				soundTheme: normalized,
				soundThemeBySource: nextSourceThemes,
			});
			playNotificationSoundForSourceThrottled('default');
		};

		const changeSourceTheme = (
			source: NotificationSourceKey,
			value: DesktopNotificationSoundTheme
		) => {
			const normalized = normalizeDesktopSoundTheme(value);
			const nextSourceThemes = {
				...sourceThemes,
				[source]: normalized,
			};
			setSourceThemes(nextSourceThemes);
			updateDesktopNotificationSettings({
				soundThemeBySource: nextSourceThemes,
			});
			void persistSoundPrefs({ soundThemeBySource: nextSourceThemes });
			playNotificationSoundForSourceThrottled(source);
		};

		const toggleSourceEnabled = (source: NotificationSourceKey) => {
			const nextSourceEnabled = {
				...sourceEnabled,
				[source]: !(sourceEnabled[source] !== false),
			};
			setSourceEnabled(nextSourceEnabled);
			updateDesktopNotificationSettings({
				soundEnabledBySource: nextSourceEnabled,
			});
			void persistSoundPrefs({ soundEnabledBySource: nextSourceEnabled });
		};

		const toggleAllSocket = () => {
			const next = !allSocketEvents;
			setAllSocketEvents(next);
			void persistSoundPrefs({ allSocketEvents: next });
		};

		const quickSettingsGridClass = cn(
			'grid gap-3',
			!embeddedMobileLayout && 'xl:grid-cols-2'
		);

		if (loading) {
			return (
				<div className={NH_QUICK_SETTINGS_ROOT_CLASS}>
					<NotificationHubSettingsLoading text={t('loading')} />
				</div>
			);
		}

		return (
			<div className={NH_QUICK_SETTINGS_ROOT_CLASS} aria-busy={saving}>
				<NotificationHubSoundSettings
					embeddedMobileLayout={embeddedMobileLayout}
					saving={saving}
					sound={sound}
					doNotDisturb={doNotDisturb}
					allSocketEvents={allSocketEvents}
					theme={theme}
					onToggleSound={toggleSound}
					onToggleDnd={toggleDnd}
					onToggleAllSocket={toggleAllSocket}
					onChangeTheme={changeTheme}
					onTestSoundOnly={playNotificationSound}
					onPreviewSoundTheme={playNotificationSoundPreview}
				/>

				<NotificationHubSourceSoundSettings
					embeddedMobileLayout={embeddedMobileLayout}
					saving={saving}
					sourceThemes={sourceThemes}
					sourceEnabled={sourceEnabled}
					onToggleSourceEnabled={toggleSourceEnabled}
					onChangeSourceTheme={changeSourceTheme}
				/>

				<NotificationHubNotifyTestPanel doNotDisturb={doNotDisturb} />

				<div className={quickSettingsGridClass}>
					<div className={NH_QUICK_SETTINGS_SECTION_CARD_CLASS}>
						<GafTrayNotificationSettings
							saving={saving}
							persistPreferences={persistPreferences}
						/>
					</div>
					<div className={NH_QUICK_SETTINGS_SECTION_CARD_CLASS}>
						<UgsTrayNotificationSettings
							saving={saving}
							persistPreferences={persistPreferences}
						/>
					</div>
				</div>
			</div>
		);
	});

NotificationHubQuickSettings.displayName = 'NotificationHubQuickSettings';
