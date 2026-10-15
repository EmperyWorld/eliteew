/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Taskbar clock and date display with mini month calendar flyout + seconds toggle.
 *
 * Invariants:
 * - Mini month grid marks days with personal events or assistant plan tasks (accent dot).
 * - Outside-click dismiss respects Quest laser open guard (same pattern as Start menu / tray).
 * - Cadence realigns on tab visibility return (background throttling).
 * - Seconds flyout Escape uses `useShellCaptureEscape` so taskbar shell Escape defers.
 *
 * Related:
 * - components/TaskbarRightToolbar.tsx
 * - apps/calendarApp/CalendarMiniMonthGrid.tsx
 * - hooks/useTaskbarMiniCalendarEvents.ts
 */

import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	lazy,
	Suspense,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopPopoverOpenGuard } from '@/pages/Desktop/hooks/useDesktopPopoverOpenGuard';
import { useShellCaptureEscape } from '@/pages/Desktop/hooks/useShellCaptureKeyboard';
import { DESKTOP_TYPOGRAPHY, TASKBAR } from '@/pages/Desktop/constants';
import { useFinePointerHover } from '@/pages/Desktop/hooks/useFinePointerHover';
import { useTaskbarShellClockPrefs } from '@/pages/Desktop/hooks/useDesktopTaskbarShellPrefs';
import { shouldCloseClockMenuOnOutsidePointer } from '@/pages/Desktop/utils/desktopShellOutsideDismiss';
import {
	getTaskbarClockInitialDelayMs,
	getTaskbarClockTickMs,
} from '@/pages/Desktop/utils/taskbarClockTiming';
import { subscribeDocumentVisibleSync } from '@/pages/Desktop/utils/subscribeDocumentVisibleSync';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { notify } from '@/notifications';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import { getFloatingMenuPosition } from '@/pages/Desktop/utils/desktopUi';
import { useTaskbarClockTodayIndicator } from '@/pages/Desktop/hooks/useTaskbarClockTodayIndicator';
import { useTaskbarMiniCalendarEvents } from '@/pages/Desktop/hooks/useTaskbarMiniCalendarEvents';
import { requestOpenCalendarApp } from '@/pages/Desktop/utils/calendarDeepLink';
import { startOfLocalDay } from '@/pages/Desktop/utils/desktopCalendarEventPolicy';
import { TaskbarMiniCalendarDayPreview } from '@/pages/Desktop/apps/calendarApp/TaskbarMiniCalendarDayPreview';
import {
	DesktopAppButton,
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
} from './DesktopAppChrome';
import {
	TaskbarIconContextMenu,
	type TaskbarIconContextMenuPoint,
} from './TaskbarIconContextMenu';
import { TASKBAR_CLOCK_DATE_CLASS } from './taskbarStrip/taskbarChrome';

const CalendarMiniMonthGrid = lazy(() =>
	import('@/pages/Desktop/apps/calendarApp/CalendarMiniMonthGrid').then(
		(m) => ({
			default: m.CalendarMiniMonthGrid,
		})
	)
);

const CLOCK_FLYOUT_WIDTH_PX = 288;
const CLOCK_FLYOUT_HEIGHT_PX = 520;

export type TaskbarClockHandle = {
	closeMenu: () => void;
	isMenuOpen: () => boolean;
};

export type TaskbarClockProps = {
	taskbarButtonSurface: string;
	taskbarButtonActiveSurface: string;
	/** Класс всплывающей панели (glass) для чекбокса секунд */
	shellPanel: string;
};

export const TaskbarClock = forwardRef<TaskbarClockHandle, TaskbarClockProps>(
	function TaskbarClock(
		{ taskbarButtonSurface, taskbarButtonActiveSurface, shellPanel },
		ref
	) {
		const { showSeconds, persistClockShowSeconds } =
			useTaskbarShellClockPrefs();
		const { t, i18n } = useTranslation('desktopUi');
		const clockLocale = useMemo(() => {
			const raw = i18n.resolvedLanguage ?? i18n.language ?? 'ru';
			return raw.replace(/_/g, '-');
		}, [i18n.resolvedLanguage, i18n.language]);
		const reduceMotion = useReducedMotion();
		const finePointerHover = useFinePointerHover();
		const [time, setTime] = useState(() => new Date());
		const [showClockMenu, setShowClockMenu] = useState(false);
		const [contextMenu, setContextMenu] =
			useState<TaskbarIconContextMenuPoint | null>(null);
		const clockToggleRef = useRef<HTMLButtonElement>(null);
		const clockMenuRef = useRef<HTMLDivElement>(null);
		const clockOpenClickGuardRef = useDesktopPopoverOpenGuard(showClockMenu);
		const { Portal, portalProps } = useShellPortal({
			layer: 'shell_global',
			dismissOnEscape: false,
			trapFocus: false,
			onDismiss: () => setShowClockMenu(false),
		});
		const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
		const [viewMonth, setViewMonth] = useState(() =>
			startOfLocalDay(new Date())
		);
		const [selectedDay, setSelectedDay] = useState(() =>
			startOfLocalDay(new Date())
		);
		const today = useMemo(() => startOfLocalDay(new Date()), []);
		const miniCalendarEvents = useTaskbarMiniCalendarEvents(
			viewMonth,
			showClockMenu
		);
		const todayHasEvents = useTaskbarClockTodayIndicator();

		const syncAnchorRect = useCallback(() => {
			if (!clockToggleRef.current) return;
			setAnchorRect(clockToggleRef.current.getBoundingClientRect());
		}, []);

		useImperativeHandle(
			ref,
			() => ({
				closeMenu: () => setShowClockMenu(false),
				isMenuOpen: () => showClockMenu,
			}),
			[showClockMenu]
		);

		useShellCaptureEscape(showClockMenu, () => setShowClockMenu(false));

		useEffect(() => {
			const tickMs = getTaskbarClockTickMs(showSeconds);
			let timeoutId: number | null = null;
			let intervalId: number | null = null;

			const clearTimers = () => {
				if (timeoutId !== null) {
					window.clearTimeout(timeoutId);
					timeoutId = null;
				}
				if (intervalId !== null) {
					window.clearInterval(intervalId);
					intervalId = null;
				}
			};

			const updateNow = () => setTime(new Date());

			const scheduleCadence = () => {
				clearTimers();
				updateNow();
				timeoutId = window.setTimeout(() => {
					updateNow();
					intervalId = window.setInterval(updateNow, tickMs);
				}, getTaskbarClockInitialDelayMs({ showSeconds }));
			};

			const syncVisibleClock = () => {
				scheduleCadence();
			};

			scheduleCadence();
			const unsubVisible = subscribeDocumentVisibleSync(syncVisibleClock);

			return () => {
				unsubVisible();
				clearTimers();
			};
		}, [showSeconds]);

		useEffect(() => {
			if (!showClockMenu) return;
			syncAnchorRect();
		}, [showClockMenu, syncAnchorRect]);

		useEffect(() => {
			if (!showClockMenu) return;
			const onLayout = () => syncAnchorRect();
			window.addEventListener('resize', onLayout);
			window.addEventListener('scroll', onLayout, true);
			return () => {
				window.removeEventListener('resize', onLayout);
				window.removeEventListener('scroll', onLayout, true);
			};
		}, [showClockMenu, syncAnchorRect]);

		useEffect(() => {
			if (!showClockMenu) return;
			const close = (e: MouseEvent | PointerEvent) => {
				if (
					!shouldCloseClockMenuOnOutsidePointer({
						openClickGuardActive: clockOpenClickGuardRef.current,
						target: e.target as Element,
						panelRoot: clockMenuRef.current,
					})
				) {
					return;
				}
				setShowClockMenu(false);
			};
			window.addEventListener('mousedown', close, { capture: true });
			window.addEventListener('pointerdown', close, { capture: true });
			return () => {
				window.removeEventListener('mousedown', close, { capture: true });
				window.removeEventListener('pointerdown', close, { capture: true });
			};
		}, [showClockMenu, clockOpenClickGuardRef]);

		const flyoutPos = useMemo(() => {
			if (!showClockMenu || !anchorRect) return null;
			return getFloatingMenuPosition(
				{ x: anchorRect.right - CLOCK_FLYOUT_WIDTH_PX, y: anchorRect.top },
				{
					menuWidth: CLOCK_FLYOUT_WIDTH_PX,
					menuHeight: CLOCK_FLYOUT_HEIGHT_PX,
					preferAbove: true,
					anchorGap: 8,
				}
			);
		}, [anchorRect, showClockMenu]);

		const timeLabel = time.toLocaleTimeString(clockLocale, {
			hour: '2-digit',
			minute: '2-digit',
			...(showSeconds ? { second: '2-digit' } : {}),
		});
		const dateLabel = time.toLocaleDateString(clockLocale, {
			day: 'numeric',
			month: 'short',
		});
		const fullDateTimeLabel = time.toLocaleString(clockLocale, {
			dateStyle: 'medium',
			timeStyle: showSeconds ? 'medium' : 'short',
		});
		const closeContextMenu = () => setContextMenu(null);

		return (
			<div className="relative flex items-center">
				<m.button
					ref={clockToggleRef}
					data-taskbar-interactive="true"
					data-clock-toggle="true"
					type="button"
					onClick={() => setShowClockMenu((v) => !v)}
					onContextMenu={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setContextMenu({ x: event.clientX, y: event.clientY });
					}}
					className={`flex min-h-11 min-w-11 cursor-pointer flex-col items-end justify-center rounded-lg px-3 py-2 text-right min-[380px]:px-3.5 ${TASKBAR.ICON_FOCUS} ${showClockMenu ? taskbarButtonActiveSurface : taskbarButtonSurface}`}
					whileHover={
						finePointerHover && !reduceMotion ? { scale: 1.01 } : undefined
					}
					aria-label={t('taskbar.clockAria')}
					aria-expanded={showClockMenu}
					aria-haspopup="dialog"
				>
					<span className={DESKTOP_TYPOGRAPHY.taskbarClock}>{timeLabel}</span>
					<span className={`relative ${TASKBAR_CLOCK_DATE_CLASS}`}>
						{dateLabel}
						{todayHasEvents ? (
							<span
								className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb))]"
								aria-hidden
							/>
						) : null}
					</span>
				</m.button>
				<AnimatePresence>
					{showClockMenu && flyoutPos ? (
						<Portal>
							<m.div
								ref={clockMenuRef}
								role="dialog"
								aria-label={t('taskbar.clockMiniCalendarAria')}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 8 }}
								className={`fixed w-72 ${shellPanel} p-3`}
								style={{
									left: flyoutPos.x,
									top: flyoutPos.y,
									zIndex: portalProps?.zIndex,
								}}
								onMouseDown={(event) => event.stopPropagation()}
								onPointerDown={(event) => event.stopPropagation()}
							>
								<Suspense fallback={null}>
									<CalendarMiniMonthGrid
										viewMonth={viewMonth}
										selectedDay={selectedDay}
										today={today}
										locale={clockLocale}
										events={miniCalendarEvents}
										compact
										onViewMonthChange={setViewMonth}
										onSelectDay={(day) => {
											setSelectedDay(day);
											setViewMonth(
												new Date(day.getFullYear(), day.getMonth(), 1)
											);
										}}
									/>
								</Suspense>
								<TaskbarMiniCalendarDayPreview
									selectedDay={selectedDay}
									events={miniCalendarEvents}
									locale={clockLocale}
								/>
								<div className="mt-3 flex flex-col gap-2 border-t border-(--desktop-border-subtle) pt-3">
									<div className="flex gap-2">
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											className="flex-1"
											onClick={() => {
												setSelectedDay(today);
												setViewMonth(
													new Date(today.getFullYear(), today.getMonth(), 1)
												);
											}}
										>
											{t('taskbar.clockMiniCalendarToday')}
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="accent"
											className="flex-1"
											onClick={() => {
												requestOpenCalendarApp({ selectedDay });
												setShowClockMenu(false);
											}}
										>
											{t('taskbar.clockOpenCalendarDay')}
										</DesktopAppButton>
									</div>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										className="w-full"
										onClick={() => {
											requestOpenCalendarApp();
											setShowClockMenu(false);
										}}
									>
										{t('taskbar.clockOpenCalendar')}
									</DesktopAppButton>
									<label className="flex cursor-pointer items-center gap-2 text-sm text-(--desktop-text-secondary)">
										<input
											type="checkbox"
											checked={showSeconds}
											onChange={(e) => {
												persistClockShowSeconds(e.target.checked);
											}}
											className="rounded accent-[rgb(var(--desktop-accent-rgb))]"
										/>
										{t('taskbar.clockSeconds')}
									</label>
								</div>
							</m.div>
						</Portal>
					) : null}
				</AnimatePresence>
				<TaskbarIconContextMenu
					point={contextMenu}
					onClose={closeContextMenu}
					menuWidth={220}
					menuHeight={142}
					className="min-w-55"
				>
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						onClick={() => {
							setShowClockMenu((value) => !value);
							closeContextMenu();
						}}
					>
						{t('taskbar.trayContextClockSettings')}
					</DesktopAppMenuItem>
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						onClick={() => {
							persistClockShowSeconds(!showSeconds);
							closeContextMenu();
						}}
					>
						{showSeconds
							? t('taskbar.trayContextHideClockSeconds')
							: t('taskbar.trayContextShowClockSeconds')}
					</DesktopAppMenuItem>
					<DesktopAppMenuDivider />
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						onClick={() => {
							void (async () => {
								const copied = await safeCopyToClipboard(fullDateTimeLabel);
								if (copied) {
									notify.success(t('taskbar.trayContextCopyDateTimeDone'));
								} else {
									notify.error(t('taskbar.trayContextCopyDateTimeFailed'));
								}
								closeContextMenu();
							})();
						}}
					>
						{t('taskbar.trayContextCopyDateTime')}
					</DesktopAppMenuItem>
				</TaskbarIconContextMenu>
			</div>
		);
	}
);

TaskbarClock.displayName = 'TaskbarClock';
