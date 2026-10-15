/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Floating desktop widget orchestrator (clock, credits, now playing, perf/notifications).
 *
 * Invariants:
 * - Widget reflects transport state from NowPlayingContext without creating parallel audio state.
 * - Menu/telemetry overlays remain keyboard reachable and portal-safe.
 *
 * Related:
 * - DesktopWorkspaceContent.tsx
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import { SecureAvatar } from '../../../../components/profile/SecureAvatar';
import AuthStatusIndicator from '../../../../components/ui/AuthStatusIndicator';
import { useAvailableCredits } from '../../../../components/ui/useAvailableCredits';
import { useAuth } from '../../../../contexts/AuthContext';
import { cn } from '@/utils/cn';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE, DESKTOP_TYPOGRAPHY } from '../../constants';
import { getDesktopWidgetRootClassName } from '../../utils/desktopVisualSystem';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { DesktopFloatingWidgetNowPlayingStrip } from './DesktopFloatingWidgetNowPlayingStrip';
import { FloatingWidgetClockSection } from './FloatingWidgetClockSection';
import { FloatingWidgetContextMenu } from './FloatingWidgetContextMenu';
import { FloatingWidgetExpandedPanel } from './FloatingWidgetExpandedPanel';
import { shouldOpenFloatingWidgetContextMenu } from './helpers';
import type { DesktopWorkspaceFloatingWidgetProps } from './types';
import { useFloatingWidgetClock } from './useFloatingWidgetClock';
import { useFloatingWidgetDrag } from './useFloatingWidgetDrag';
import { useFloatingWidgetShellPrefs } from './useFloatingWidgetShellPrefs';
import {
	widgetCreditsClassName,
	widgetSectionClassName,
} from './widgetChromeStyles';

const DesktopWorkspaceFloatingWidget: React.FC<DesktopWorkspaceFloatingWidgetProps> =
	React.memo(
		({
			performance,
			suspendTelemetry = false,
			deferRealtimeUpdates = false,
			windowCount,
			notifications,
			onOpenProfile,
			avatarUrl,
			onHide,
			onOpenPerformanceSettings,
			onOpenNotificationCenter,
			widgetsStyle,
			widgetPosition,
			onWidgetPositionCommit,
			iconReservedViewportBounds = null,
		}) => {
			const { t, i18n } = useTranslation('desktopUi', {
				keyPrefix: 'floatingWidgetCtx',
			});
			const clockLocale = useMemo(() => {
				const raw = i18n.resolvedLanguage ?? i18n.language ?? 'ru';
				return raw.replace(/_/g, '-');
			}, [i18n.resolvedLanguage, i18n.language]);
			const reduceMotion = useReducedMotion();
			const { user } = useAuth();
			const { formattedCredits } = useAvailableCredits();
			const avatarSrc = avatarUrl ?? user?.profile?.avatar_url;
			const userId = user?.id ?? 'anonymous';

			const [isExpanded, setIsExpanded] = useState(false);
			const [fwCtxMenu, setFwCtxMenu] = useState<{
				x: number;
				y: number;
			} | null>(null);

			const closeFwCtxMenu = useCallback(() => setFwCtxMenu(null), []);

			const {
				timezone,
				setTimezone,
				isQuietMode,
				setIsQuietMode,
				scheduleWidgetShellPersist,
			} = useFloatingWidgetShellPrefs(userId);

			const time = useFloatingWidgetClock(isExpanded, deferRealtimeUpdates);

			const {
				widgetRootRef,
				widgetRootStyle,
				isPresetFloatingLayout,
				handleWidgetDragPointerDown,
				handleWidgetDragPointerMove,
				handleWidgetDragPointerUp,
				handleWidgetDragLostCapture,
			} = useFloatingWidgetDrag({
				widgetPosition,
				onWidgetPositionCommit,
				iconReservedViewportBounds,
				isExpanded,
			});

			useEffect(() => {
				if (suspendTelemetry && isExpanded) {
					setIsExpanded(false);
				}
			}, [suspendTelemetry, isExpanded]);

			const {
				metrics,
				isHighPerformanceMode,
				preferAggressiveBackgroundSuspend,
				recommendations,
				setPreferAggressiveBackgroundSuspend,
			} = performance;

			const handleTimezoneChange = useCallback(
				(value: string) => {
					setTimezone(value);
					scheduleWidgetShellPersist({ timezone: value });
				},
				[scheduleWidgetShellPersist, setTimezone]
			);

			const handleToggleQuietMode = useCallback(() => {
				setIsQuietMode((prev) => {
					const next = !prev;
					scheduleWidgetShellPersist({ quiet_mode: next });
					return next;
				});
			}, [scheduleWidgetShellPersist, setIsQuietMode]);

			return (
				<>
					<m.div
						ref={widgetRootRef}
						style={widgetRootStyle}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{
							duration: reduceMotion ? 0 : 0.22,
						}}
						className={getDesktopWidgetRootClassName(
							widgetsStyle,
							isPresetFloatingLayout ? 'preset-corner' : 'free'
						)}
						onPointerMove={handleWidgetDragPointerMove}
						onPointerUp={handleWidgetDragPointerUp}
						onPointerCancel={handleWidgetDragPointerUp}
						onLostPointerCapture={handleWidgetDragLostCapture}
						onContextMenu={(e) => {
							if (!shouldOpenFloatingWidgetContextMenu(e)) return;
							setFwCtxMenu({ x: e.clientX, y: e.clientY });
						}}
					>
						{onWidgetPositionCommit ? (
							<DesktopChromeTooltip
								content={t('dragMove')}
								placement="top"
								offsetExtra={6}
							>
								<button
									type="button"
									onPointerDown={handleWidgetDragPointerDown}
									className={cn(
										'absolute left-2 right-10 top-0 z-12 h-2 touch-none cursor-grab rounded-b border-0 bg-transparent p-0',
										'active:cursor-grabbing',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-label={t('dragMove')}
								/>
							</DesktopChromeTooltip>
						) : null}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0"
						>
							<div className="absolute inset-x-0 top-0 h-px bg-[rgb(var(--desktop-fg-primary-rgb)/0.1)]" />
							<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_22%,rgb(var(--desktop-bg-primary-rgb)/0.06)_100%)]" />
							<div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.16)] blur-3xl" />
						</div>
						{onHide && (
							<DesktopChromeTooltip
								content={t('hide')}
								placement="left"
								offsetExtra={6}
							>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onHide();
									}}
									className="absolute right-2.5 top-2.5 z-10 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-1 text-(--desktop-text-muted) opacity-0 pointer-events-none transition-[opacity,background-color,color] duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)"
									aria-label={t('hide')}
								>
									<XMarkIcon className="w-3.5 h-3.5" />
								</button>
							</DesktopChromeTooltip>
						)}
						<div className="relative flex items-start gap-2.5 p-3 pb-2.5">
							<div className="flex shrink-0 flex-col items-center gap-1.5">
								<div
									className={`${widgetSectionClassName} flex w-full items-center justify-center px-1.5 py-1`}
								>
									<AuthStatusIndicator mode="nav" isCollapsed className="" />
								</div>
								<div className={widgetCreditsClassName}>
									<span
										className={cn(
											DESKTOP_TYPOGRAPHY.widgetKpi,
											'relative block text-center tracking-normal'
										)}
									>
										{formattedCredits}
									</span>
								</div>
								{onOpenProfile ? (
									<div className="flex shrink-0 flex-col items-center gap-1.5">
										<DesktopChromeTooltip
											content={t('profileTooltip')}
											placement="left"
											offsetExtra={6}
										>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onOpenProfile();
												}}
												className="flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-[1.05rem] border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--glass-bg-strong)_84%,transparent_16%)] shadow-[0_12px_24px_rgba(2,6,23,0.24)] transition-colors hover:bg-(--desktop-surface-soft-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]"
												aria-label={t('profileSettingsAria')}
											>
												<SecureAvatar
													avatarUrl={avatarSrc ?? null}
													className="h-full w-full object-cover"
													alt=""
												/>
											</button>
										</DesktopChromeTooltip>
									</div>
								) : null}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-start gap-2">
									<FloatingWidgetClockSection
										isExpanded={isExpanded}
										onToggleExpanded={() => setIsExpanded((v) => !v)}
										time={time}
										clockLocale={clockLocale}
										timezone={timezone}
										onTimezoneChange={handleTimezoneChange}
										windowCount={windowCount}
										unreadCount={notifications.unreadCount}
										isHighPerformanceMode={isHighPerformanceMode}
									/>
								</div>
							</div>
						</div>

						<DesktopFloatingWidgetNowPlayingStrip />

						<AnimatePresence>
							{isExpanded && (
								<m.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									className="border-t border-(--desktop-border-subtle) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-primary-rgb)/0.04),rgb(var(--desktop-bg-primary-rgb)/0.1))]"
								>
									<FloatingWidgetExpandedPanel
										suspendTelemetry={suspendTelemetry}
										metrics={metrics}
										windowCount={windowCount}
										isHighPerformanceMode={isHighPerformanceMode}
										preferAggressiveBackgroundSuspend={
											preferAggressiveBackgroundSuspend ?? false
										}
										recommendations={recommendations ?? []}
										setPreferAggressiveBackgroundSuspend={
											setPreferAggressiveBackgroundSuspend
										}
										unreadCount={notifications.unreadCount}
										isQuietMode={isQuietMode}
										onToggleQuietMode={handleToggleQuietMode}
										onMarkAllAsRead={notifications.markAllAsRead}
									/>
								</m.div>
							)}
						</AnimatePresence>
					</m.div>
					<FloatingWidgetContextMenu
						position={fwCtxMenu}
						onClose={closeFwCtxMenu}
						onHide={onHide}
						onOpenProfile={onOpenProfile}
						onOpenNotificationCenter={onOpenNotificationCenter}
						onOpenPerformanceSettings={onOpenPerformanceSettings}
						markAllAsRead={notifications.markAllAsRead}
					/>
				</>
			);
		}
	);

DesktopWorkspaceFloatingWidget.displayName = 'DesktopWorkspaceFloatingWidget';

export { DesktopWorkspaceFloatingWidget };
