/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clock, timezone selector, and status chips for the floating widget header.
 *
 * Invariants:
 * - Toggle button expands/collapses widget; timezone persists via shell pipeline callback.
 * - Timezone label is sentence-case (`FLOATING_WIDGET_TIMEZONE_LABEL_CLASS`), not uppercase shout.
 *
 * Related:
 * - constants/desktopShellTimezoneOptions.ts
 * - DesktopAppChrome.tsx (DesktopNativeSelect)
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DESKTOP_SHELL_TIMEZONE_OPTIONS } from '../../constants/desktopShellTimezoneOptions';
import {
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../DesktopAppChrome';
import {
	FLOATING_WIDGET_TIMEZONE_LABEL_CLASS,
	widgetChipClassName,
	widgetSectionClassName,
} from './widgetChromeStyles';

export interface FloatingWidgetClockSectionProps {
	isExpanded: boolean;
	onToggleExpanded: () => void;
	time: Date;
	clockLocale: string;
	timezone: string;
	onTimezoneChange: (value: string) => void;
	windowCount: number;
	unreadCount: number;
	isHighPerformanceMode: boolean;
}

export function FloatingWidgetClockSection({
	isExpanded,
	onToggleExpanded,
	time,
	clockLocale,
	timezone,
	onTimezoneChange,
	windowCount,
	unreadCount,
	isHighPerformanceMode,
}: FloatingWidgetClockSectionProps) {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'floatingWidgetCtx',
	});

	return (
		<button
			type="button"
			className="flex-1 min-w-0 rounded-[1.1rem] p-1.5 text-left transition-colors hover:bg-[rgb(var(--desktop-fg-primary-rgb)/0.05)]"
			onClick={onToggleExpanded}
			aria-expanded={isExpanded}
		>
			<div className={DESKTOP_TYPOGRAPHY.widgetClock}>
				{time.toLocaleTimeString(clockLocale, {
					hour: '2-digit',
					minute: '2-digit',
					timeZone: timezone,
				})}
			</div>
			<div className={cn(DESKTOP_TYPOGRAPHY.widgetDate, 'mt-1')}>
				{time.toLocaleDateString(clockLocale, {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					timeZone: timezone,
				})}
			</div>
			<div className={`mt-2.5 ${widgetSectionClassName} p-2.5`}>
				<label
					className={FLOATING_WIDGET_TIMEZONE_LABEL_CLASS}
					htmlFor="desktop-widget-timezone"
				>
					{t('timezoneLabel')}
				</label>
				<DesktopNativeSelect
					id="desktop-widget-timezone"
					onClick={(e) => e.stopPropagation()}
					value={timezone}
					onChange={(e) => {
						onTimezoneChange(e.target.value);
					}}
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'w-full min-w-0 rounded-[0.9rem] leading-snug'
					)}
				>
					{DESKTOP_SHELL_TIMEZONE_OPTIONS.map((option) => (
						<option
							key={option.value}
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							value={option.value}
						>
							{option.label}
						</option>
					))}
				</DesktopNativeSelect>
			</div>
			<div className="mt-2.5 flex flex-wrap gap-1.5">
				<span className={widgetChipClassName}>
					{t('windowsOpen', { count: windowCount })}
				</span>
				<span className={widgetChipClassName}>
					{t('newNotifications', { count: unreadCount })}
				</span>
				<span className={widgetChipClassName}>
					{isHighPerformanceMode
						? t('performanceModeHigh')
						: t('performanceModeBalanced')}
				</span>
			</div>
		</button>
	);
}
