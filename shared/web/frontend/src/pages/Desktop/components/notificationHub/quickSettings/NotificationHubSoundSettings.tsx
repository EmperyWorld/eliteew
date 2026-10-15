/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sound, DND, server-feed toggle, and global theme rail for Notification Hub Quick Settings.
 *
 * Invariants:
 * - Optimistic UI reverts on persist failure via parent persist helper.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx, notificationSound.ts
 */

import { cn } from '@/utils/cn';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '../../../constants';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import type { DesktopNotificationSoundTheme } from '../../../utils/notificationSound';
import { DESKTOP_NOTIFICATION_SOUND_THEMES } from '../../../utils/notificationSound';
import {
	NH_QUICK_SETTINGS_ACTION_ROW_CLASS,
	NH_QUICK_SETTINGS_CONTROL_LABEL_CENTER_CLASS,
	NH_QUICK_SETTINGS_CONTROL_LABEL_CLASS,
	NH_QUICK_SETTINGS_CONTROL_TILE_CLASS,
	NH_QUICK_SETTINGS_INLINE_HINT_CLASS,
	NH_QUICK_SETTINGS_SECTION_CARD_CLASS,
	NH_QUICK_SETTINGS_THEME_RAIL_CLASS,
	NH_SECTION_LABEL_NORMAL_CLASS,
	nhFilterChipButtonClass,
} from '../notificationHubLayoutTokens';
import {
	BellIcon,
	ServerIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';

export type NotificationHubSoundSettingsProps = {
	embeddedMobileLayout?: boolean;
	saving: boolean;
	sound: boolean;
	doNotDisturb: boolean;
	allSocketEvents: boolean;
	theme: DesktopNotificationSoundTheme;
	onToggleSound: () => void;
	onToggleDnd: () => void;
	onToggleAllSocket: () => void;
	onChangeTheme: (value: DesktopNotificationSoundTheme) => void;
	onTestSoundOnly: () => void;
	onPreviewSoundTheme: () => void;
};

export const NotificationHubSoundSettings: React.FC<NotificationHubSoundSettingsProps> =
	memo(
		({
			embeddedMobileLayout = false,
			saving,
			sound,
			doNotDisturb,
			allSocketEvents,
			theme,
			onToggleSound,
			onToggleDnd,
			onToggleAllSocket,
			onChangeTheme,
			onTestSoundOnly,
			onPreviewSoundTheme,
		}) => {
			const { t } = useTranslation('desktopUi', {
				keyPrefix: 'notificationHub',
			});
			const themeOptions = DESKTOP_NOTIFICATION_SOUND_THEMES.map((id) => ({
				id,
			}));
			const sectionCardClass = NH_QUICK_SETTINGS_SECTION_CARD_CLASS;
			const controlTileClass = NH_QUICK_SETTINGS_CONTROL_TILE_CLASS;
			const soundLabel = t('quickSettings.sound');
			const dndLabel = t('quickSettings.doNotDisturb');
			const allSocketLabel = allSocketEvents
				? t('quickSettings.allSocketStateAll')
				: t('quickSettings.allSocketStateImportant');
			const testSoundOnlyLabel = t('quickSettings.testSoundOnly');
			const testSoundPreviewLabel = t('quickSettings.testSoundPreview');
			const quickSettingsGridClass = cn(
				'grid gap-3',
				!embeddedMobileLayout && 'xl:grid-cols-2'
			);
			const controlGridClass = cn(
				'mt-2 grid grid-cols-1 gap-2',
				!embeddedMobileLayout && 'sm:grid-cols-3'
			);

			return (
				<div className={quickSettingsGridClass} aria-busy={saving}>
					<div className={sectionCardClass}>
						<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
							{t('quickSettings.sectionTitle')}
						</DesktopAppSectionLabel>
						<div className={controlGridClass}>
							<DesktopChromeTooltip
								content={soundLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									onClick={onToggleSound}
									variant={sound ? 'accent' : 'neutral'}
									className={controlTileClass}
									disabled={saving}
								>
									{sound ? (
										<SpeakerWaveIcon
											className={DESKTOP_LUCIDE.lg}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : (
										<SpeakerXMarkIcon
											className={DESKTOP_LUCIDE.lg}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									)}
									<span className={NH_QUICK_SETTINGS_CONTROL_LABEL_CLASS}>
										{soundLabel}
									</span>
								</DesktopAppButton>
							</DesktopChromeTooltip>

							<DesktopChromeTooltip
								content={dndLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									onClick={onToggleDnd}
									variant={doNotDisturb ? 'accent' : 'neutral'}
									className={controlTileClass}
									disabled={saving}
								>
									<BellIcon
										className={cn(
											DESKTOP_LUCIDE.lg,
											doNotDisturb && 'opacity-50 line-through'
										)}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									<span className={NH_QUICK_SETTINGS_CONTROL_LABEL_CLASS}>
										{dndLabel}
									</span>
								</DesktopAppButton>
							</DesktopChromeTooltip>

							<DesktopChromeTooltip
								content={allSocketLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									onClick={onToggleAllSocket}
									variant={allSocketEvents ? 'accent' : 'neutral'}
									className={controlTileClass}
									disabled={saving}
								>
									<ServerIcon
										className={DESKTOP_LUCIDE.lg}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									<span
										className={NH_QUICK_SETTINGS_CONTROL_LABEL_CENTER_CLASS}
									>
										{allSocketLabel}
									</span>
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</div>
						<p className={NH_QUICK_SETTINGS_INLINE_HINT_CLASS}>
							{t('quickSettings.allSocketHint')}
						</p>
					</div>

					<div className={sectionCardClass}>
						<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
							{t('quickSettings.soundThemeLabel')}
						</DesktopAppSectionLabel>
						<div className={NH_QUICK_SETTINGS_THEME_RAIL_CLASS}>
							{themeOptions.map((option) => {
								const isActive = theme === option.id;
								const themeLabel = t(`quickSettings.themes.${option.id}`);
								return (
									<DesktopChromeTooltip
										key={option.id}
										content={themeLabel}
										placement="top"
										offsetExtra={4}
									>
										<DesktopAppButton
											type="button"
											onClick={() => onChangeTheme(option.id)}
											variant={isActive ? 'accent' : 'ghost'}
											size="sm"
											className={nhFilterChipButtonClass()}
											disabled={saving}
										>
											{themeLabel}
										</DesktopAppButton>
									</DesktopChromeTooltip>
								);
							})}
						</div>
						<div className={NH_QUICK_SETTINGS_ACTION_ROW_CLASS}>
							<DesktopChromeTooltip
								content={testSoundOnlyLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={onTestSoundOnly}
									aria-label={t('quickSettings.testSoundOnlyAria')}
									disabled={saving}
								>
									{testSoundOnlyLabel}
								</DesktopAppButton>
							</DesktopChromeTooltip>
							<DesktopChromeTooltip
								content={testSoundPreviewLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={onPreviewSoundTheme}
									aria-label={t('quickSettings.testSoundPreviewAria')}
									disabled={saving}
								>
									{testSoundPreviewLabel}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</div>
					</div>
				</div>
			);
		}
	);

NotificationHubSoundSettings.displayName = 'NotificationHubSoundSettings';
