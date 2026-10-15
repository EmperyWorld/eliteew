/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Month/week calendar grid for CalendarApp with selectable days and event chips.
 *
 * Related:
 * - CalendarApp.tsx
 */

import { useState, type DragEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppSurface } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import type { CalendarGridCell } from '../../utils/desktopCalendarEventPolicy';
import {
	eventOverlapsLocalDay,
	isEventContinuationOnLocalDay,
	localDayKey,
} from '../../utils/desktopCalendarEventPolicy';
import {
	CALENDAR_EVENT_DRAG_MIME,
	CalendarEventChip,
} from './CalendarEventChip';
import { sortCalendarEventsByStart } from './calendarAppFormatting';

const MAX_CELL_EVENT_CHIPS = 3;

export type CalendarGridPanelProps = {
	view: 'month' | 'week';
	cells: CalendarGridCell[];
	weekdayLabels: string[];
	events: DesktopCalendarEventResponse[];
	selectedDay: Date;
	today: Date;
	locale: string;
	onSelectDay: (day: Date, options?: { openCreate?: boolean }) => void;
	onEditEvent: (event: DesktopCalendarEventResponse, day: Date) => void;
	onMoveEvent: (event: DesktopCalendarEventResponse, targetDay: Date) => void;
};

function sameLocalDay(a: Date, b: Date): boolean {
	return localDayKey(a) === localDayKey(b);
}

function eventsForDay(
	events: DesktopCalendarEventResponse[],
	day: Date
): DesktopCalendarEventResponse[] {
	return sortCalendarEventsByStart(
		events.filter((event) => eventOverlapsLocalDay(event, day))
	);
}

export function CalendarGridPanel({
	view,
	cells,
	weekdayLabels,
	events,
	selectedDay,
	today,
	locale,
	onSelectDay,
	onEditEvent,
	onMoveEvent,
}: CalendarGridPanelProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const [dropTargetDayKey, setDropTargetDayKey] = useState<string | null>(null);
	const cellMinHeight = view === 'week' ? 'min-h-[9rem]' : 'min-h-[5.5rem]';
	const weekHeaderCells = view === 'week' ? cells.slice(0, 7) : [];

	const handleDragOver = (
		dragEvent: DragEvent<HTMLElement>,
		dayKey: string
	) => {
		if (!dragEvent.dataTransfer.types.includes(CALENDAR_EVENT_DRAG_MIME)) {
			return;
		}
		dragEvent.preventDefault();
		setDropTargetDayKey(dayKey);
	};

	const handleDrop = (dragEvent: DragEvent<HTMLElement>, day: Date) => {
		dragEvent.preventDefault();
		setDropTargetDayKey(null);
		const eventId = dragEvent.dataTransfer.getData(CALENDAR_EVENT_DRAG_MIME);
		if (!eventId) return;
		const event = events.find((item) => item.id === eventId);
		if (event) onMoveEvent(event, day);
	};

	const renderEventChips = (
		cellEvents: DesktopCalendarEventResponse[],
		cell: CalendarGridCell
	) =>
		cellEvents
			.slice(0, MAX_CELL_EVENT_CHIPS)
			.map((event) => (
				<CalendarEventChip
					key={event.id}
					event={event}
					locale={locale}
					cellDay={cell.date}
					isContinuation={isEventContinuationOnLocalDay(event, cell.date)}
					continuedLabel={t('continued')}
					onClick={() => onEditEvent(event, cell.date)}
				/>
			));

	const cellShellClass = (
		cell: CalendarGridCell,
		selected: boolean,
		isToday: boolean
	) =>
		cn(
			'flex w-full flex-col gap-1 p-2 transition-colors',
			cellMinHeight,
			view === 'month' && !cell.inMonth && 'opacity-45',
			selected &&
				'bg-(--desktop-surface-accent) ring-2 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.55)]',
			!selected && 'hover:bg-(--desktop-surface-soft-hover)',
			isToday &&
				!selected &&
				'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]',
			dropTargetDayKey === localDayKey(cell.date) &&
				'ring-2 ring-dashed ring-[rgb(var(--desktop-accent-rgb))]'
		);

	return (
		<DesktopAppSurface variant="panel" padding="sm" className="min-w-0">
			<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'mb-2 px-1')}>
				{t('dragHint')}
			</p>
			<div className="overflow-x-auto">
				<table
					className="w-full table-fixed border-collapse"
					aria-label={t('gridLabel')}
				>
					<thead>
						<tr>
							{view === 'week'
								? weekHeaderCells.map((cell) => {
										const isToday = sameLocalDay(cell.date, today);
										const selected = sameLocalDay(cell.date, selectedDay);
										return (
											<th
												key={localDayKey(cell.date)}
												scope="col"
												className="border-b border-(--desktop-border-subtle) px-1 py-2 text-center"
											>
												<button
													type="button"
													className={cn(
														'flex w-full flex-col items-center gap-0.5 rounded-(--desktop-radius) px-1 py-0.5 transition-colors hover:bg-(--desktop-surface-soft-hover)',
														selected &&
															'bg-(--desktop-surface-accent) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
													)}
													onClick={() => onSelectDay(cell.date)}
												>
													<span className="text-[10px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
														{cell.date.toLocaleDateString(locale, {
															weekday: 'short',
														})}
													</span>
													<span
														className={cn(
															'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
															isToday
																? 'bg-[rgb(var(--desktop-accent-rgb))] text-white'
																: 'text-(--desktop-text-primary)'
														)}
													>
														{cell.date.getDate()}
													</span>
													{isToday ? (
														<span className="text-[9px] font-semibold uppercase tracking-wide text-[rgb(var(--desktop-accent-rgb))]">
															{t('nowLabel')}
														</span>
													) : null}
												</button>
											</th>
										);
									})
								: weekdayLabels.map((label) => (
										<th
											key={label}
											scope="col"
											className="border-b border-(--desktop-border-subtle) px-1 py-2 text-center text-xs font-medium text-(--desktop-text-muted)"
										>
											{label}
										</th>
									))}
						</tr>
					</thead>
					<tbody>
						{Array.from(
							{ length: Math.ceil(cells.length / 7) },
							(_, rowIndex) => {
								const rowCells = cells.slice(rowIndex * 7, rowIndex * 7 + 7);
								const rowKey = localDayKey(rowCells[0]?.date ?? new Date(0));
								return (
									<tr key={rowKey}>
										{rowCells.map((cell) => {
											const cellEvents = eventsForDay(events, cell.date);
											const selected = sameLocalDay(cell.date, selectedDay);
											const isToday = sameLocalDay(cell.date, today);
											const dayKey = localDayKey(cell.date);
											return (
												<td
													key={dayKey}
													className="border-b border-r border-(--desktop-border-subtle) p-0 align-top last:border-r-0"
												>
													{/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: day cell shell; arrow keys handled in CalendarApp */}
													<div
														className={cellShellClass(cell, selected, isToday)}
														onClick={() => onSelectDay(cell.date)}
														onDoubleClick={() =>
															onSelectDay(cell.date, { openCreate: true })
														}
														onDragOver={(dragEvent) =>
															handleDragOver(dragEvent, dayKey)
														}
														onDragLeave={() => setDropTargetDayKey(null)}
														onDrop={(dragEvent) =>
															handleDrop(dragEvent, cell.date)
														}
													>
														{view === 'month' ? (
															<button
																type="button"
																aria-pressed={selected}
																className="flex w-full items-center gap-2 p-2 text-left"
																onClick={(clickEvent) => {
																	clickEvent.stopPropagation();
																	onSelectDay(cell.date);
																}}
																onDoubleClick={(clickEvent) => {
																	clickEvent.stopPropagation();
																	onSelectDay(cell.date, {
																		openCreate: true,
																	});
																}}
															>
																<span
																	className={cn(
																		DESKTOP_TYPOGRAPHY.body,
																		'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
																		isToday &&
																			'bg-[rgb(var(--desktop-accent-rgb))] font-semibold text-white'
																	)}
																>
																	{cell.date.getDate()}
																</span>
																{cellEvents.length > 0 ? (
																	<span className="flex gap-0.5" aria-hidden>
																		{(['dot-a', 'dot-b', 'dot-c'] as const)
																			.slice(0, Math.min(3, cellEvents.length))
																			.map((dotKey) => (
																				<span
																					key={`${dayKey}-${dotKey}`}
																					className="h-1 w-1 rounded-full bg-[rgb(var(--desktop-accent-rgb))]"
																				/>
																			))}
																	</span>
																) : null}
															</button>
														) : null}
														<div className="flex min-w-0 flex-col gap-0.5 p-2 pt-0">
															{renderEventChips(cellEvents, cell)}
															{cellEvents.length === 0 && view === 'week' ? (
																<span className={DESKTOP_TYPOGRAPHY.caption}>
																	{t('weekDayEmpty')}
																</span>
															) : null}
															{cellEvents.length > MAX_CELL_EVENT_CHIPS ? (
																<button
																	type="button"
																	className={cn(
																		DESKTOP_TYPOGRAPHY.caption,
																		'text-left hover:underline'
																	)}
																	onClick={(clickEvent) => {
																		clickEvent.stopPropagation();
																		onSelectDay(cell.date);
																	}}
																>
																	{t('moreEvents', {
																		count:
																			cellEvents.length - MAX_CELL_EVENT_CHIPS,
																	})}
																</button>
															) : null}
														</div>
													</div>
												</td>
											);
										})}
									</tr>
								);
							}
						)}
					</tbody>
				</table>
			</div>
		</DesktopAppSurface>
	);
}
