/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop CalendarApp window: month/week grid, day agenda, create/edit events.
 *
 * Invariants:
 * - Personal events from GET /calendar/events; assistant plan due dates overlay (editable via companion-plans PATCH).
 * - Custom token grid only — no FullCalendar / React Big Calendar.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 * - shared/apps/calendar/app.manifest.yaml
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppSectionLabel,
	DesktopAppSkeleton,
	DesktopAppSurface,
	DesktopProductHeader,
	DesktopProductStatusBanner,
	DesktopProductWorkspace,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopPopoverOpenGuard } from '@/pages/Desktop/hooks/useDesktopPopoverOpenGuard';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import { getFloatingMenuPosition } from '@/pages/Desktop/utils/desktopUi';
import { cn } from '@/utils/cn';
import { CalendarDayAgendaPanel } from './calendarApp/CalendarDayAgendaPanel';
import { CalendarGridPanel } from './calendarApp/CalendarGridPanel';
import { CalendarMiniMonthGrid } from './calendarApp/CalendarMiniMonthGrid';
import { CalendarAppSearchField } from './calendarApp/CalendarAppSearchField';
import { CalendarAppLegend } from './calendarApp/CalendarAppLegend';
import {
	clampDayToMonth,
	filterCalendarEventsByQuery,
	findTodayHighlightEvent,
	formatHighlightEventLabel,
	formatSelectedDayHeading,
	formatToolbarPeriodLabel,
	isCalendarTypingTarget,
	sortCalendarEventsByStart,
} from './calendarApp/calendarAppFormatting';
import { useDesktopCalendarEvents } from '../hooks/useDesktopCalendarEvents';
import {
	consumeCalendarSelectedDayDeepLink,
	parseCalendarDayKey,
} from '@/pages/Desktop/utils/calendarDeepLink';
import { useCompanionPlanCalendarOverlay } from '../hooks/useCompanionPlanCalendarOverlay';
import {
	assistantPlanTaskIdFromCalendarId,
	calendarDraftToCompanionPlanTaskPatch,
	isAssistantPlanCalendarItem,
	mergeCalendarEventsWithCompanionPlanTasks,
} from '../utils/companionPlanCalendarOverlay';
import type { DesktopCalendarEventResponse } from '../services/desktopApi';
import {
	completeEwaCompanionPlanTask,
	updateEwaCompanionPlanTask,
} from '@/services/ewa/ewaCompanionPlansApi';
import { dispatchCompanionActivePlanInvalidated } from '@/services/ewa/companionActivePlanInvalidation';
import {
	addLocalDays,
	buildMonthGridCells,
	buildWeekDays,
	eventOverlapsLocalDay,
	localDayKey,
	monthQueryRange,
	shiftEventIntervalToLocalDay,
	startOfLocalDay,
	weekQueryRange,
} from '../utils/desktopCalendarEventPolicy';

type CalendarView = 'month' | 'week';

const MONTH_PICKER_WIDTH_PX = 288;
const MONTH_PICKER_HEIGHT_PX = 320;

function sameLocalDay(a: Date, b: Date): boolean {
	return localDayKey(a) === localDayKey(b);
}

export function CalendarApp(): ReactElement {
	const { t, i18n } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const today = startOfLocalDay(new Date());
	const [cursor, setCursor] = useState(() => new Date(today));
	const [selectedDay, setSelectedDay] = useState(() => new Date(today));
	const [view, setView] = useState<CalendarView>('month');
	const [monthPickerOpen, setMonthPickerOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [editor, setEditor] = useState<
		| null
		| { mode: 'create' }
		| { mode: 'edit'; event: DesktopCalendarEventResponse }
	>(null);
	const [planBusy, setPlanBusy] = useState(false);
	const [planError, setPlanError] = useState(false);
	const agendaRef = useRef<HTMLDivElement>(null);
	const monthPickerRef = useRef<HTMLDivElement>(null);
	const monthPickerTriggerRef = useRef<HTMLButtonElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const monthPickerGuardRef = useDesktopPopoverOpenGuard(monthPickerOpen);
	const [monthPickerAnchorRect, setMonthPickerAnchorRect] =
		useState<DOMRect | null>(null);
	const { Portal: MonthPickerPortal, portalProps: monthPickerPortalProps } =
		useShellPortal({
			layer: 'embedded_popover',
			appComponent: 'CalendarApp',
			dismissOnEscape: false,
			trapFocus: false,
			onDismiss: () => setMonthPickerOpen(false),
		});

	const syncMonthPickerAnchor = useCallback(() => {
		if (!monthPickerTriggerRef.current) return;
		setMonthPickerAnchorRect(
			monthPickerTriggerRef.current.getBoundingClientRect()
		);
	}, []);

	const range = useMemo(
		() =>
			view === 'month'
				? monthQueryRange(cursor.getFullYear(), cursor.getMonth())
				: weekQueryRange(selectedDay),
		[cursor, selectedDay, view]
	);
	const calendar = useDesktopCalendarEvents(range);
	const companionPlanOverlay = useCompanionPlanCalendarOverlay();
	const mergedEvents = useMemo(
		() =>
			mergeCalendarEventsWithCompanionPlanTasks(
				calendar.events,
				companionPlanOverlay.planTasks
			),
		[calendar.events, companionPlanOverlay.planTasks]
	);
	const locale = i18n.language || 'en';
	const visibleEvents = useMemo(
		() => filterCalendarEventsByQuery(mergedEvents, searchQuery),
		[mergedEvents, searchQuery]
	);
	const searchActive = searchQuery.trim().length > 0;

	const cells = useMemo(
		() =>
			view === 'month'
				? buildMonthGridCells(cursor.getFullYear(), cursor.getMonth())
				: buildWeekDays(selectedDay).map((date) => ({ date, inMonth: true })),
		[cursor, selectedDay, view]
	);
	const weekdayLabels = useMemo(() => {
		const monday = buildWeekDays(today);
		return monday.map((day) =>
			day.toLocaleDateString(locale, { weekday: 'short' })
		);
	}, [locale, today]);
	const dayEvents = useMemo(
		() =>
			sortCalendarEventsByStart(
				visibleEvents.filter((event) =>
					eventOverlapsLocalDay(event, selectedDay)
				)
			),
		[visibleEvents, selectedDay]
	);
	const dayEventsUnfiltered = useMemo(
		() =>
			sortCalendarEventsByStart(
				mergedEvents.filter((event) =>
					eventOverlapsLocalDay(event, selectedDay)
				)
			),
		[mergedEvents, selectedDay]
	);
	const highlightEvent = useMemo(() => {
		if (localDayKey(selectedDay) !== localDayKey(today)) return null;
		return findTodayHighlightEvent(visibleEvents, selectedDay, new Date());
	}, [visibleEvents, selectedDay, today]);
	const periodAnchor = view === 'month' ? cursor : selectedDay;

	const selectDay = useCallback(
		(day: Date, options?: { openCreate?: boolean }) => {
			const normalized = startOfLocalDay(day);
			setSelectedDay(normalized);
			if (view === 'week') setCursor(normalized);
			if (!sameLocalDay(normalized, cursor) && view === 'month') {
				setCursor(new Date(normalized.getFullYear(), normalized.getMonth(), 1));
			}
			if (options?.openCreate) {
				setEditor({ mode: 'create' });
			}
			window.requestAnimationFrame(() => {
				agendaRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
				});
			});
		},
		[cursor, view]
	);

	useEffect(() => {
		const dayKey = consumeCalendarSelectedDayDeepLink();
		if (!dayKey) return;
		const parsed = parseCalendarDayKey(dayKey);
		if (!parsed) return;
		selectDay(parsed);
	}, [selectDay]);

	const openEditEvent = (event: DesktopCalendarEventResponse, day: Date) => {
		selectDay(day);
		setPlanError(false);
		setEditor({ mode: 'edit', event });
	};

	const moveSelectedDay = useCallback(
		(deltaDays: number) => {
			selectDay(addLocalDays(selectedDay, deltaDays));
		},
		[selectDay, selectedDay]
	);

	const shiftCursor = (delta: number) => {
		if (view === 'month') {
			const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
			setCursor(next);
			setSelectedDay(
				clampDayToMonth(selectedDay, next.getFullYear(), next.getMonth())
			);
			return;
		}
		const next = new Date(selectedDay);
		next.setDate(next.getDate() + delta * 7);
		setSelectedDay(next);
		setCursor(next);
	};

	useEffect(() => {
		if (!monthPickerOpen) return;
		syncMonthPickerAnchor();
	}, [monthPickerOpen, syncMonthPickerAnchor]);

	useEffect(() => {
		if (!monthPickerOpen) return;
		const onLayout = () => syncMonthPickerAnchor();
		window.addEventListener('resize', onLayout);
		window.addEventListener('scroll', onLayout, true);
		return () => {
			window.removeEventListener('resize', onLayout);
			window.removeEventListener('scroll', onLayout, true);
		};
	}, [monthPickerOpen, syncMonthPickerAnchor]);

	useEffect(() => {
		if (!monthPickerOpen) return;
		const close = (event: MouseEvent | PointerEvent) => {
			if (monthPickerGuardRef.current) return;
			const target = event.target as Node | null;
			if (monthPickerRef.current?.contains(target)) return;
			if (monthPickerTriggerRef.current?.contains(target)) return;
			setMonthPickerOpen(false);
		};
		window.addEventListener('mousedown', close, { capture: true });
		window.addEventListener('pointerdown', close, { capture: true });
		return () => {
			window.removeEventListener('mousedown', close, { capture: true });
			window.removeEventListener('pointerdown', close, { capture: true });
		};
	}, [monthPickerGuardRef, monthPickerOpen]);

	const monthPickerPos = useMemo(() => {
		if (!monthPickerOpen || !monthPickerAnchorRect) return null;
		return getFloatingMenuPosition(
			{
				x: monthPickerAnchorRect.left,
				y: monthPickerAnchorRect.bottom + 8,
			},
			{
				menuWidth: MONTH_PICKER_WIDTH_PX,
				menuHeight: MONTH_PICKER_HEIGHT_PX,
				preferAbove: false,
				anchorGap: 8,
			}
		);
	}, [monthPickerAnchorRect, monthPickerOpen]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (editor) {
					setEditor(null);
					return;
				}
				if (monthPickerOpen) {
					setMonthPickerOpen(false);
				}
				return;
			}

			if (isCalendarTypingTarget(event.target)) return;
			if (editor || monthPickerOpen) return;

			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				moveSelectedDay(-1);
				return;
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				moveSelectedDay(1);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				moveSelectedDay(-7);
				return;
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				moveSelectedDay(7);
				return;
			}
			if (event.key === 't' || event.key === 'T') {
				event.preventDefault();
				selectDay(today);
				return;
			}
			if (event.key === 'n' || event.key === 'N') {
				event.preventDefault();
				setEditor({ mode: 'create' });
				return;
			}
			if (event.key === '/') {
				event.preventDefault();
				searchInputRef.current?.focus();
				return;
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				if (dayEvents.length > 0) {
					setEditor({ mode: 'edit', event: dayEvents[0] });
				} else {
					setEditor({ mode: 'create' });
				}
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [dayEvents, editor, monthPickerOpen, moveSelectedDay, selectDay, today]);

	return (
		<DesktopAppContentWrapper appComponent="CalendarApp">
			<DesktopProductWorkspace
				header={
					<DesktopProductHeader
						eyebrow={t('eyebrow')}
						title={t('title')}
						description={t('description')}
						actions={
							<DesktopAppButton
								variant="accent"
								onClick={() => setEditor({ mode: 'create' })}
							>
								{t('newEvent')}
							</DesktopAppButton>
						}
					/>
				}
				toolbar={
					<div className="flex flex-col gap-3 px-4 pb-3">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<DesktopAppButton
									variant="ghost"
									size="sm"
									onClick={() => shiftCursor(-1)}
								>
									{t('prev')}
								</DesktopAppButton>
								<button
									ref={monthPickerTriggerRef}
									type="button"
									className={cn(
										DESKTOP_TYPOGRAPHY.title,
										'rounded-(--desktop-radius) px-2 py-1 transition-colors hover:bg-(--desktop-surface-soft-hover) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--desktop-accent-rgb))]'
									)}
									aria-expanded={monthPickerOpen}
									aria-haspopup="dialog"
									onClick={() => setMonthPickerOpen((value) => !value)}
								>
									{formatToolbarPeriodLabel(view, periodAnchor, locale)}
								</button>
								{monthPickerOpen && monthPickerPos ? (
									<MonthPickerPortal>
										<div
											ref={monthPickerRef}
											role="dialog"
											aria-label={t('jumpToMonth')}
											className="fixed w-72 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-3 shadow-lg"
											style={{
												left: monthPickerPos.x,
												top: monthPickerPos.y,
												zIndex: monthPickerPortalProps?.zIndex,
											}}
											onMouseDown={(event) => event.stopPropagation()}
											onPointerDown={(event) => event.stopPropagation()}
										>
											<CalendarMiniMonthGrid
												viewMonth={cursor}
												selectedDay={selectedDay}
												today={today}
												locale={locale}
												events={visibleEvents}
												onViewMonthChange={setCursor}
												onSelectDay={(day) => {
													selectDay(day);
													setMonthPickerOpen(false);
												}}
											/>
										</div>
									</MonthPickerPortal>
								) : null}
								<DesktopAppButton
									variant="ghost"
									size="sm"
									onClick={() => shiftCursor(1)}
								>
									{t('next')}
								</DesktopAppButton>
								<DesktopAppButton
									variant="neutral"
									size="sm"
									onClick={() => selectDay(today)}
								>
									{t('today')}
								</DesktopAppButton>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<CalendarAppSearchField
								value={searchQuery}
								inputRef={searchInputRef}
								onChange={setSearchQuery}
							/>
							<CalendarAppLegend />
							<div className="flex gap-1">
								<DesktopAppButton
									size="sm"
									variant={view === 'month' ? 'accent' : 'ghost'}
									onClick={() => setView('month')}
								>
									{t('viewMonth')}
								</DesktopAppButton>
								<DesktopAppButton
									size="sm"
									variant={view === 'week' ? 'accent' : 'ghost'}
									onClick={() => {
										setView('week');
										setCursor(selectedDay);
									}}
								>
									{t('viewWeek')}
								</DesktopAppButton>
							</div>
						</div>
					</div>
				}
				status={
					calendar.isError ? (
						<DesktopProductStatusBanner
							tone="danger"
							title={t('loadErrorTitle')}
							description={t('loadErrorBody')}
							actions={
								<DesktopAppButton
									size="sm"
									onClick={() => void calendar.refetch()}
								>
									{t('retry')}
								</DesktopAppButton>
							}
						/>
					) : companionPlanOverlay.isError ? (
						<DesktopProductStatusBanner
							tone="danger"
							title={t('planOverlayLoadErrorTitle')}
							description={t('planOverlayLoadErrorBody')}
						/>
					) : calendar.saveError || planError ? (
						<DesktopProductStatusBanner
							tone="danger"
							title={t(planError ? 'planSaveErrorTitle' : 'saveErrorTitle')}
							description={t(planError ? 'planSaveErrorBody' : 'saveErrorBody')}
						/>
					) : null
				}
			>
				{calendar.isLoading ? (
					<div className="p-4">
						<DesktopAppSkeleton className="h-64" />
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
						<DesktopAppSurface
							variant="inset"
							padding="md"
							className="flex flex-wrap items-center justify-between gap-3"
						>
							<div>
								<DesktopAppSectionLabel>
									{t('selectedDayLabel')}
								</DesktopAppSectionLabel>
								<p className={DESKTOP_TYPOGRAPHY.title}>
									{formatSelectedDayHeading(selectedDay, locale)}
								</p>
								<p className={DESKTOP_TYPOGRAPHY.caption}>
									{t('eventCount', { count: dayEvents.length })}
									{searchActive
										? ` · ${t('searchResultsCount', { count: visibleEvents.length })}`
										: null}
									{' · '}
									{t('gridHint')}
									{' · '}
									{t('keyboardHint')}
								</p>
								{highlightEvent ? (
									<button
										type="button"
										className={cn(
											DESKTOP_TYPOGRAPHY.body,
											'mt-2 text-left text-[rgb(var(--desktop-accent-rgb))] hover:underline'
										)}
										onClick={() =>
											setEditor({ mode: 'edit', event: highlightEvent })
										}
									>
										{t('nextUpLabel')}:{' '}
										{formatHighlightEventLabel(
											highlightEvent,
											new Date(),
											locale,
											{
												inProgress: t('relativeInProgress'),
												upcoming: (minutes) =>
													t('relativeUpcoming', { count: minutes }),
												allDay: t('allDay'),
											}
										)}
									</button>
								) : null}
							</div>
							<DesktopAppButton
								variant="accent"
								size="sm"
								onClick={() => setEditor({ mode: 'create' })}
							>
								{t('addEventForDay')}
							</DesktopAppButton>
						</DesktopAppSurface>

						<div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
							<CalendarGridPanel
								view={view}
								cells={cells}
								weekdayLabels={weekdayLabels}
								events={visibleEvents}
								selectedDay={selectedDay}
								today={today}
								locale={locale}
								onSelectDay={selectDay}
								onEditEvent={openEditEvent}
								onMoveEvent={async (event, targetDay) => {
									if (isAssistantPlanCalendarItem(event.id)) {
										const taskId = assistantPlanTaskIdFromCalendarId(event.id);
										const shifted = shiftEventIntervalToLocalDay(
											event,
											targetDay
										);
										if (!taskId || !shifted) {
											setPlanError(true);
											return;
										}
										const patch = calendarDraftToCompanionPlanTaskPatch({
											title: event.title,
											notes: event.notes,
											all_day: event.all_day,
											starts_at: shifted.starts_at,
											ends_at: shifted.ends_at,
										});
										if (!patch) {
											setPlanError(true);
											return;
										}
										setPlanBusy(true);
										setPlanError(false);
										try {
											await updateEwaCompanionPlanTask(taskId, patch);
											dispatchCompanionActivePlanInvalidated();
											selectDay(targetDay);
										} catch {
											setPlanError(true);
										} finally {
											setPlanBusy(false);
										}
										return;
									}
									const shifted = shiftEventIntervalToLocalDay(
										event,
										targetDay
									);
									if (!shifted) return;
									await calendar.updateEvent({
										id: event.id,
										data: shifted,
									});
									selectDay(targetDay);
								}}
							/>

							<div ref={agendaRef} className="min-w-0">
								<CalendarDayAgendaPanel
									selectedDay={selectedDay}
									today={today}
									locale={locale}
									events={dayEvents}
									searchActive={searchActive}
									dayHasUnfilteredEvents={dayEventsUnfiltered.length > 0}
									editor={editor}
									busy={calendar.isSaving || planBusy}
									onOpenCreate={() => setEditor({ mode: 'create' })}
									onOpenEdit={(event) => {
										setPlanError(false);
										setEditor({ mode: 'edit', event });
									}}
									onCloseEditor={() => setEditor(null)}
									onSave={async (draft) => {
										if (
											editor?.mode === 'edit' &&
											isAssistantPlanCalendarItem(editor.event.id)
										) {
											const taskId = assistantPlanTaskIdFromCalendarId(
												editor.event.id
											);
											const patch =
												calendarDraftToCompanionPlanTaskPatch(draft);
											if (!taskId || !patch) {
												setPlanError(true);
												return;
											}
											setPlanBusy(true);
											setPlanError(false);
											try {
												await updateEwaCompanionPlanTask(taskId, patch);
												dispatchCompanionActivePlanInvalidated();
												setEditor(null);
											} catch {
												setPlanError(true);
											} finally {
												setPlanBusy(false);
											}
											return;
										}
										if (editor?.mode === 'edit') {
											await calendar.updateEvent({
												id: editor.event.id,
												data: draft,
											});
										} else {
											await calendar.createEvent(draft);
										}
										setEditor(null);
									}}
									onDelete={async (eventId) => {
										if (isAssistantPlanCalendarItem(eventId)) {
											const taskId = assistantPlanTaskIdFromCalendarId(eventId);
											if (!taskId) {
												setPlanError(true);
												return;
											}
											setPlanBusy(true);
											setPlanError(false);
											try {
												await completeEwaCompanionPlanTask(taskId);
												dispatchCompanionActivePlanInvalidated();
												if (
													editor?.mode === 'edit' &&
													editor.event.id === eventId
												) {
													setEditor(null);
												}
											} catch {
												setPlanError(true);
											} finally {
												setPlanBusy(false);
											}
											return;
										}
										await calendar.deleteEvent(eventId);
										if (
											editor?.mode === 'edit' &&
											editor.event.id === eventId
										) {
											setEditor(null);
										}
									}}
									onDuplicate={async (event) => {
										const shifted = shiftEventIntervalToLocalDay(
											event,
											selectedDay
										);
										if (!shifted) return;
										await calendar.createEvent({
											title: event.title,
											notes: event.notes,
											all_day: event.all_day,
											starts_at: shifted.starts_at,
											ends_at: shifted.ends_at,
										});
										setEditor(null);
									}}
								/>
							</div>
						</div>
					</div>
				)}
			</DesktopProductWorkspace>
		</DesktopAppContentWrapper>
	);
}

export default CalendarApp;
