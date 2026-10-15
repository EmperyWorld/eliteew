/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-source sound enable/theme matrix for Notification Hub Quick Settings.
 *
 * Invariants:
 * - Source order excludes `server`; disabled sources cannot pick themes.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx, sourceMeta.ts
 */

import {
	type NotificationSourceKey,
	NOTIFICATION_SOURCE_ORDER,
	getNotificationSourceI18nKey,
} from '@/notifications/sourceMeta';
import { cn } from '@/utils/cn';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import type { DesktopNotificationSoundTheme } from '../../../utils/notificationSound';
import { DESKTOP_NOTIFICATION_SOUND_THEMES } from '../../../utils/notificationSound';
import {
	NH_QUICK_SETTINGS_PREF_ROW_LABEL_CLASS,
	NH_QUICK_SETTINGS_SECTION_CARD_CLASS,
	NH_QUICK_SETTINGS_SECTION_DESC_CLASS,
	NH_QUICK_SETTINGS_SOURCE_LIST_CLASS,
	NH_QUICK_SETTINGS_SOURCE_SOUND_ROW_CLASS,
	NH_QUICK_SETTINGS_SOURCE_STATUS_CLASS,
	NH_QUICK_SETTINGS_TOGGLE_ROW_CLASS,
	NH_SECTION_LABEL_NORMAL_CLASS,
	nhFilterChipButtonClass,
} from '../notificationHubLayoutTokens';

export type NotificationHubSourceSoundSettingsProps = {
	embeddedMobileLayout?: boolean;
	saving: boolean;
	sourceThemes: Record<NotificationSourceKey, DesktopNotificationSoundTheme>;
	sourceEnabled: Record<NotificationSourceKey, boolean>;
	onToggleSourceEnabled: (source: NotificationSourceKey) => void;
	onChangeSourceTheme: (
		source: NotificationSourceKey,
		value: DesktopNotificationSoundTheme
	) => void;
};

export const NotificationHubSourceSoundSettings: React.FC<NotificationHubSourceSoundSettingsProps> =
	memo(
		({
			embeddedMobileLayout = false,
			saving,
			sourceThemes,
			sourceEnabled,
			onToggleSourceEnabled,
			onChangeSourceTheme,
		}) => {
			const { t } = useTranslation('desktopUi', {
				keyPrefix: 'notificationHub',
			});
			const themeOptions = DESKTOP_NOTIFICATION_SOUND_THEMES.map((id) => ({
				id,
			}));
			const sourceThemeOrder = NOTIFICATION_SOURCE_ORDER.filter(
				(source) => source !== 'server'
			);
			const sourceSoundGridClass = cn(
				'grid gap-2',
				!embeddedMobileLayout &&
					'md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:items-start'
			);
			const sourceSoundHeadClass = cn(
				'flex items-center justify-between gap-2',
				!embeddedMobileLayout && 'md:flex-col md:items-start md:justify-start'
			);

			return (
				<div
					className={NH_QUICK_SETTINGS_SECTION_CARD_CLASS}
					aria-busy={saving}
				>
					<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
						{t('quickSettings.sourceSoundTitle')}
					</DesktopAppSectionLabel>
					<p className={NH_QUICK_SETTINGS_SECTION_DESC_CLASS}>
						{t('quickSettings.sourceSoundHint')}
					</p>
					<div className={NH_QUICK_SETTINGS_SOURCE_LIST_CLASS}>
						{sourceThemeOrder.map((sourceKey) => {
							const sourceLabel = t(getNotificationSourceI18nKey(sourceKey));
							const active = sourceThemes[sourceKey];
							const enabled = sourceEnabled[sourceKey] !== false;
							const enabledLabel = enabled ? t('toggle.on') : t('toggle.off');
							return (
								<div
									key={sourceKey}
									className={NH_QUICK_SETTINGS_SOURCE_SOUND_ROW_CLASS}
								>
									<div className={sourceSoundGridClass}>
										<div className={sourceSoundHeadClass}>
											<p className={NH_QUICK_SETTINGS_PREF_ROW_LABEL_CLASS}>
												{sourceLabel}
											</p>
											<p className={NH_QUICK_SETTINGS_SOURCE_STATUS_CLASS}>
												{enabledLabel}
											</p>
										</div>
										<DesktopChromeTooltip
											content={enabledLabel}
											placement="top"
											offsetExtra={4}
										>
											<DesktopAppButton
												type="button"
												size="sm"
												variant={enabled ? 'accent' : 'ghost'}
												onClick={() => onToggleSourceEnabled(sourceKey)}
												className={nhFilterChipButtonClass()}
												disabled={saving}
											>
												{enabledLabel}
											</DesktopAppButton>
										</DesktopChromeTooltip>
										<div className={NH_QUICK_SETTINGS_TOGGLE_ROW_CLASS}>
											{themeOptions.map((option) => {
												const themeLabel = t(
													`quickSettings.themes.${option.id}`
												);
												return (
													<DesktopChromeTooltip
														key={`${sourceKey}-${option.id}`}
														content={themeLabel}
														placement="top"
														offsetExtra={4}
													>
														<DesktopAppButton
															type="button"
															size="sm"
															variant={
																active === option.id ? 'accent' : 'ghost'
															}
															onClick={() =>
																onChangeSourceTheme(sourceKey, option.id)
															}
															disabled={!enabled || saving}
															className={nhFilterChipButtonClass()}
														>
															{themeLabel}
														</DesktopAppButton>
													</DesktopChromeTooltip>
												);
											})}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			);
		}
	);

NotificationHubSourceSoundSettings.displayName =
	'NotificationHubSourceSoundSettings';
