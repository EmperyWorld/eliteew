/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Floating desktop widget visibility and clock/quiet prefs (shell_state).
 *
 * Related:
 * - `DesktopSettingsWidgetsTab.tsx`
 * - `useFloatingWidgetShellPrefs.ts`
 */

import { cn } from '@/utils/cn';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { DESKTOP_INTERACTIVE, DESKTOP_TYPOGRAPHY } from '../../constants';
import { DESKTOP_SHELL_TIMEZONE_OPTIONS } from '../../constants/desktopShellTimezoneOptions';
import { DESKTOP_SETTINGS_WIDGETS_ANCHORS } from '../../constants/desktopSettingsWidgetsAnchors';
import { buildDesktopSettingsFieldElementId } from '../../utils/desktopSettingsFieldElementIds';
import type { DesktopSettingsCenterSyncPrefs } from '../../types/desktopSettingsCenterBridge.types';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { DesktopSettingsShellHelpers } from './desktopSettingsShared.types';
import { SettingsFormCard } from './DesktopSettingsFormCard';

export type DesktopSettingsWidgetsFloatingCardProps = {
	desktopFloatingWidgetVisible: boolean;
	onDesktopFloatingWidgetVisibleChange: (value: boolean) => void;
	syncPrefs: DesktopSettingsCenterSyncPrefs;
	shell: DesktopSettingsShellHelpers;
};

export const DesktopSettingsWidgetsFloatingCard: FC<
	DesktopSettingsWidgetsFloatingCardProps
> = ({
	desktopFloatingWidgetVisible,
	onDesktopFloatingWidgetVisibleChange,
	syncPrefs,
	shell,
}) => {
	const { t } = useTranslation('desktopUi');
	const floatingLabel = desktopFloatingWidgetVisible
		? t('settingsPanel.hideFloatingWidget')
		: t('settingsPanel.showFloatingWidget');

	return (
		<SettingsFormCard
			id={DESKTOP_SETTINGS_WIDGETS_ANCHORS.floating}
			title={t('settingsPanel.cardFloatingWidgetTitle')}
			windowStyle={shell.windowStyle}
		>
			<div
				id={buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_floating_widget_visible'
				)}
				className="scroll-mt-20"
				aria-hidden
			/>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.captionInherit,
					'mb-3 text-(--desktop-text-dim)'
				)}
			>
				{t('settingsPanel.widgetsTab.floatingDesc')}
			</p>
			<DesktopChromeTooltip
				content={floatingLabel}
				placement="top"
				offsetExtra={4}
			>
				<button
					type="button"
					onClick={() =>
						onDesktopFloatingWidgetVisibleChange(!desktopFloatingWidgetVisible)
					}
					className={cn(
						'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none',
						DESKTOP_CHROME_FOCUS_VISIBLE,
						desktopFloatingWidgetVisible
							? 'bg-[rgb(var(--desktop-accent-rgb)/0.25)] text-(--desktop-text-primary)'
							: 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)',
						DESKTOP_INTERACTIVE.btn
					)}
				>
					<Squares2X2Icon className="size-4" aria-hidden />
					{floatingLabel}
				</button>
			</DesktopChromeTooltip>

			<h4 className="mt-5 mb-2 text-sm font-semibold text-(--desktop-text-primary)">
				{t('settingsPanel.widgetsTab.floatingClockTitle')}
			</h4>
			<div className="grid gap-3 sm:grid-cols-2">
				<label
					id={buildDesktopSettingsFieldElementId(
						'shell_state',
						'clock_show_seconds'
					)}
					className="inline-flex cursor-pointer items-center gap-2 scroll-mt-20 text-sm text-(--desktop-text-secondary)"
				>
					<input
						type="checkbox"
						className={shell.checkboxClass}
						checked={syncPrefs.showSeconds}
						onChange={(event) =>
							syncPrefs.onShowSecondsChange(event.target.checked)
						}
					/>
					{t('settingsPanel.syncPrefsClockSeconds')}
				</label>
				<label
					id={buildDesktopSettingsFieldElementId('shell_state', 'quiet_mode')}
					className="inline-flex cursor-pointer items-center gap-2 scroll-mt-20 text-sm text-(--desktop-text-secondary)"
				>
					<input
						type="checkbox"
						className={shell.checkboxClass}
						checked={syncPrefs.quietMode}
						onChange={(event) =>
							syncPrefs.onQuietModeChange(event.target.checked)
						}
					/>
					<span>{t('settingsPanel.syncPrefsQuietMode')}</span>
				</label>
			</div>
			<label
				id={buildDesktopSettingsFieldElementId('shell_state', 'timezone')}
				className="mt-3 block scroll-mt-20 text-sm text-(--desktop-text-secondary)"
				htmlFor="desktop-settings-widgets-floating-timezone"
			>
				{t('settingsPanel.syncPrefsTimezone')}
				<select
					id="desktop-settings-widgets-floating-timezone"
					data-testid="desktop-settings-widgets-floating-timezone"
					className={cn(
						'mt-1 w-full max-w-md rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
						DESKTOP_INTERACTIVE.inputFocus
					)}
					value={syncPrefs.timezone}
					onChange={(event) => syncPrefs.onTimezoneChange(event.target.value)}
				>
					{DESKTOP_SHELL_TIMEZONE_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
			<p className="mt-2 text-xs leading-relaxed text-(--desktop-text-dim)">
				{t('settingsPanel.widgetsTab.floatingClockHint')}
			</p>
		</SettingsFormCard>
	);
};
