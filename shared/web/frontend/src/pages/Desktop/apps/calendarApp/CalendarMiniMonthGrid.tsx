/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact month grid for CalendarApp navigation and datetime popovers.
 *
 * Invariants:
 * - Custom CSS grid only — no third-party calendar widget.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 */

import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import {
	buildMonthGridCells,
	buildWeekDays,
	eventOverlapsLocalDay,
	localDayKey,
	startOfLocalDay,
} from '../../utils/desktopCalendarEventPolicy';
import { formatMonthYear } from './calendarAppFormatting';

export type CalendarMiniMonthGridProps = {
	viewMonth: Date;
	selectedDay: Date;
	today: Date;
	locale: string;
	events?: DesktopCalendarEventResponse[];
	compact?: boolean;
	showNav?: boolean;
	onViewMonthChange: (next: Date) => void;
	onSelectDay: (day: Date) => void;
};

function sameLocalDay(a: Date, b: Date): boolean {
	return localDayKey(a) === localDayKey(b);
}

export function CalendarMiniMonthGrid({
	viewMonth,
	selectedDay,
	today,
	locale,
	events = [],
	compact = false,
	showNav = true,
	onViewMonthChange,
	onSelectDay,
}: CalendarMiniMonthGridProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const cells = useMemo(
		() => buildMonthGridCells(viewMonth.getFullYear(), viewMonth.getMonth()),
		[viewMonth]
	);
	const weekdayLabels = useMemo(() => {
		const monday = buildWeekDays(today);
		return monday.map((day) =>
			day.toLocaleDateString(locale, { weekday: compact ? 'narrow' : 'short' })
		);
	}, [compact, locale, today]);

	const shiftMonth = (delta: number) => {
		const next = new Date(
			viewMonth.getFullYear(),
			viewMonth.getMonth() + delta,
			1
		);
		onViewMonthChange(next);
	};

	return (
		<div className="flex flex-col gap-2">
			{showNav ? (
				<div className="flex items-center justify-between gap-2">
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						aria-label={t('prev')}
						onClick={() => shiftMonth(-1)}
					>
						‹
					</DesktopAppButton>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-center font-medium'
						)}
					>
						{formatMonthYear(viewMonth, locale)}
					</p>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						aria-label={t('next')}
						onClick={() => shiftMonth(1)}
					>
						›
					</DesktopAppButton>
				</div>
			) : null}
			<table
				className="w-full table-fixed border-collapse"
				aria-label={t('gridLabel')}
			>
				<thead>
					<tr>
						{weekdayLabels.map((label) => (
							<th
								key={label}
								scope="col"
								className="px-0.5 py-1 text-center text-[10px] font-medium text-(--desktop-text-muted)"
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
										const selected = sameLocalDay(cell.date, selectedDay);
										const isToday = sameLocalDay(cell.date, today);
										const hasEvents = events.some((event) =>
											eventOverlapsLocalDay(event, cell.date)
										);
										const dayLabel = cell.date.toLocaleDateString(locale, {
											weekday: 'long',
											day: 'numeric',
											month: 'long',
										});
										return (
											<td key={localDayKey(cell.date)} className="p-0.5">
												<button
													type="button"
													aria-pressed={selected}
													aria-label={
														hasEvents
															? t('dayWithEventsAria', { date: dayLabel })
															: dayLabel
													}
													className={cn(
														'relative flex h-8 w-full flex-col items-center justify-center rounded-(--desktop-radius) text-xs transition-colors',
														DESKTOP_TYPOGRAPHY.captionInherit,
														!cell.inMonth &&
															'text-(--desktop-text-muted) opacity-50',
														selected &&
															'bg-(--desktop-surface-accent) font-semibold text-(--desktop-text-primary) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
														!selected &&
															'hover:bg-(--desktop-surface-soft-hover)',
														isToday &&
															!selected &&
															'ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
													)}
													onClick={() =>
														onSelectDay(startOfLocalDay(cell.date))
													}
												>
													{cell.date.getDate()}
													{hasEvents ? (
														<span
															className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[rgb(var(--desktop-accent-rgb))]"
															aria-hidden
														/>
													) : null}
												</button>
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
	);
}
