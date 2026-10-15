/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Expanded floating widget body — performance strip and notification controls.
 *
 * Invariants:
 * - Telemetry sections respect `suspendTelemetry`; quiet mode persists via shell callback.
 *
 * Related:
 * - DesktopFloatingPerformanceStrip.tsx
 */

import { cn } from '@/utils/cn';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopPerformanceRecommendation } from '../../utils/desktopPerformanceRecommendations';
import { DesktopFloatingPerformanceStrip } from '../DesktopFloatingPerformanceStrip';
import { BellIcon } from '@heroicons/react/24/outline';
import { widgetSectionClassName } from './widgetChromeStyles';

export interface FloatingWidgetExpandedPanelProps {
	suspendTelemetry: boolean;
	metrics: {
		fps: number;
		renderTime: number;
		memoryUsage: number;
		windowCount?: number;
	};
	windowCount: number;
	isHighPerformanceMode: boolean;
	preferAggressiveBackgroundSuspend: boolean;
	recommendations: DesktopPerformanceRecommendation[];
	setPreferAggressiveBackgroundSuspend?: (value: boolean) => void;
	unreadCount: number;
	isQuietMode: boolean;
	onToggleQuietMode: () => void;
	onMarkAllAsRead: () => void;
}

export function FloatingWidgetExpandedPanel({
	suspendTelemetry,
	metrics,
	windowCount,
	isHighPerformanceMode,
	preferAggressiveBackgroundSuspend,
	recommendations,
	setPreferAggressiveBackgroundSuspend,
	unreadCount,
	isQuietMode,
	onToggleQuietMode,
	onMarkAllAsRead,
}: FloatingWidgetExpandedPanelProps) {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'floatingWidgetCtx',
	});
	const reduceMotion = useReducedMotion();

	return (
		<>
			{!suspendTelemetry ? (
				<div className="px-2.5 pt-2.5">
					<div className={`${widgetSectionClassName} p-1.5`}>
						<DesktopFloatingPerformanceStrip
							data={{
								fps: metrics?.fps ?? 0,
								memoryUsage: metrics?.memoryUsage ?? 0,
								windowCount,
								renderTime: metrics?.renderTime ?? 0,
							}}
							isHighPerformanceMode={isHighPerformanceMode}
							preferAggressiveBackgroundSuspend={
								preferAggressiveBackgroundSuspend
							}
							recommendations={recommendations}
							onToggleAggressiveBackground={() => {
								if (setPreferAggressiveBackgroundSuspend) {
									setPreferAggressiveBackgroundSuspend(
										!preferAggressiveBackgroundSuspend
									);
								}
							}}
							className="mt-0"
						/>
					</div>
				</div>
			) : (
				<section
					className={`mx-2.5 mt-2.5 p-3 ${widgetSectionClassName}`}
					aria-label={t('telemetryPausedAria')}
				>
					<p className="text-xs text-(--desktop-text-dim)">
						{t('telemetryPausedBody')}
					</p>
				</section>
			)}

			<div
				className={`mx-2.5 my-2.5 p-2.5 space-y-2 ${widgetSectionClassName}`}
			>
				<div className="flex items-center justify-between gap-2 pt-1">
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'flex items-center gap-2 text-(--desktop-text-secondary)'
						)}
					>
						<BellIcon className="w-3 h-3 text-(--desktop-text-secondary)" />
						<span>{t('notificationsHeading', { count: unreadCount })}</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onToggleQuietMode}
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'px-2 py-1 rounded-lg',
								isQuietMode
									? 'bg-(--desktop-surface-soft-active) text-(--desktop-text-primary)'
									: 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary)'
							)}
						>
							{isQuietMode ? t('quietMode') : t('normalMode')}
						</button>
						{unreadCount > 0 && (
							<m.button
								type="button"
								onClick={onMarkAllAsRead}
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'px-2 py-1 rounded-lg bg-(--desktop-surface-soft) hover:bg-(--desktop-surface-soft-hover) text-(--desktop-text-secondary)'
								)}
								whileHover={reduceMotion ? undefined : { scale: 1.05 }}
								whileTap={reduceMotion ? undefined : { scale: 0.95 }}
							>
								{t('clearNotifications')}
							</m.button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
