/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Create/edit form for a personal calendar event (title, interval, all-day, notes).
 *
 * Invariants:
 * - Save is disabled while the draft fails policy (empty title / inverted times).
 * - Datetime fields open a mini calendar popover — not bare datetime-local only.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 */

import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import {
	localDayKey,
	shiftEventIntervalToLocalDay,
	validateCalendarDraft,
	parseCalendarInstant,
} from '../../utils/desktopCalendarEventPolicy';
import { CalendarDateTimeField } from './CalendarDateTimeField';
import {
	endIsoFromStartAndDurationMinutes,
	mergeLocalDateWithTime,
} from './calendarAppFormatting';

function defaultStartEnd(day: Date): { start: string; end: string } {
	const start = new Date(
		day.getFullYear(),
		day.getMonth(),
		day.getDate(),
		9,
		0
	);
	const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0);
	return { start: start.toISOString(), end: end.toISOString() };
}

function allDayInterval(day: Date): { start: string; end: string } {
	const start = new Date(
		day.getFullYear(),
		day.getMonth(),
		day.getDate(),
		0,
		0
	);
	const end = new Date(
		day.getFullYear(),
		day.getMonth(),
		day.getDate(),
		23,
		59
	);
	return { start: start.toISOString(), end: end.toISOString() };
}

export type CalendarEventEditorProps = {
	initial: DesktopCalendarEventResponse | null;
	defaultDay: Date;
	locale: string;
	busy: boolean;
	onCancel: () => void;
	onSave: (draft: {
		title: string;
		notes: string;
		starts_at: string;
		ends_at: string;
		all_day: boolean;
	}) => Promise<void>;
	onDelete?: () => Promise<void>;
	onDuplicate?: () => Promise<void>;
	kind?: 'personal' | 'assistantPlan';
};

export function CalendarEventEditor({
	initial,
	defaultDay,
	locale,
	busy,
	onCancel,
	onSave,
	onDelete,
	onDuplicate,
	kind = 'personal',
}: CalendarEventEditorProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const [deleteConfirm, setDeleteConfirm] = useState(false);
	const seed = initial ?? null;
	const defaults = defaultStartEnd(defaultDay);
	const [title, setTitle] = useState(seed?.title ?? '');
	const [notes, setNotes] = useState(seed?.notes ?? '');
	const [allDay, setAllDay] = useState(seed?.all_day ?? false);
	const [startsAt, setStartsAt] = useState(
		parseCalendarInstant(seed?.starts_at ?? defaults.start)?.toISOString() ??
			defaults.start
	);
	const [endsAt, setEndsAt] = useState(
		parseCalendarInstant(seed?.ends_at ?? defaults.end)?.toISOString() ??
			defaults.end
	);

	const issue = useMemo(
		() =>
			validateCalendarDraft({
				title,
				notes,
				startsAt,
				endsAt,
			}),
		[title, notes, startsAt, endsAt]
	);

	const canMoveToSelectedDay =
		seed != null &&
		localDayKey(
			parseCalendarInstant(seed.starts_at) ?? new Date(seed.starts_at)
		) !== localDayKey(defaultDay);

	const applyStartsAt = (nextStart: string) => {
		setStartsAt(nextStart);
		const startMs = parseCalendarInstant(nextStart)?.getTime() ?? Number.NaN;
		const endMs = parseCalendarInstant(endsAt)?.getTime() ?? Number.NaN;
		if (
			Number.isFinite(startMs) &&
			Number.isFinite(endMs) &&
			endMs <= startMs
		) {
			const bumped = endIsoFromStartAndDurationMinutes(nextStart, 60);
			if (bumped) setEndsAt(bumped);
		}
	};

	const applyMoveToSelectedDay = () => {
		const shifted = shiftEventIntervalToLocalDay(
			{ starts_at: startsAt, ends_at: endsAt, all_day: allDay },
			defaultDay
		);
		if (!shifted) return;
		setStartsAt(shifted.starts_at);
		setEndsAt(shifted.ends_at);
	};

	const applyAllDayToggle = (nextAllDay: boolean) => {
		setAllDay(nextAllDay);
		if (nextAllDay) {
			const startDay = parseCalendarInstant(startsAt) ?? new Date(startsAt);
			const interval = allDayInterval(
				Number.isFinite(startDay.getTime()) ? startDay : defaultDay
			);
			setStartsAt(interval.start);
			setEndsAt(interval.end);
			return;
		}
		const startDay = parseCalendarInstant(startsAt) ?? new Date(startsAt);
		const endDay = parseCalendarInstant(endsAt) ?? new Date(endsAt);
		if (
			!Number.isFinite(startDay.getTime()) ||
			!Number.isFinite(endDay.getTime())
		) {
			const timed = defaultStartEnd(defaultDay);
			setStartsAt(timed.start);
			setEndsAt(timed.end);
			return;
		}
		setStartsAt(
			mergeLocalDateWithTime(
				startDay,
				new Date(
					defaultDay.getFullYear(),
					defaultDay.getMonth(),
					defaultDay.getDate(),
					9,
					0
				)
			).toISOString()
		);
		setEndsAt(
			mergeLocalDateWithTime(
				endDay,
				new Date(
					defaultDay.getFullYear(),
					defaultDay.getMonth(),
					defaultDay.getDate(),
					10,
					0
				)
			).toISOString()
		);
	};

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (issue || busy) return;
				void onSave({
					title: title.trim(),
					notes: notes.trim(),
					starts_at: startsAt,
					ends_at: endsAt,
					all_day: allDay,
				});
			}}
		>
			<div className="flex flex-col gap-1">
				<label
					htmlFor="calendar-event-title"
					className={DESKTOP_TYPOGRAPHY.caption}
				>
					{t('fieldTitle')}
				</label>
				<DesktopAppInput
					id="calendar-event-title"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					autoFocus
					required
				/>
			</div>
			<label
				className="flex items-center gap-2"
				htmlFor="calendar-event-all-day"
			>
				<input
					id="calendar-event-all-day"
					type="checkbox"
					className={cn(DESKTOP_CHROME_FOCUS_VISIBLE, 'h-4 w-4')}
					checked={allDay}
					onChange={(event) => applyAllDayToggle(event.target.checked)}
				/>
				<span className={DESKTOP_TYPOGRAPHY.body}>{t('fieldAllDay')}</span>
			</label>
			{allDay ? null : (
				<div className="flex flex-wrap items-center gap-2">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('durationLabel')}
					</span>
					{(
						[
							{ key: 'duration30', minutes: 30 },
							{ key: 'duration60', minutes: 60 },
							{ key: 'duration120', minutes: 120 },
						] as const
					).map((preset) => (
						<DesktopAppButton
							key={preset.key}
							type="button"
							size="sm"
							variant="ghost"
							disabled={busy}
							onClick={() => {
								const nextEnd = endIsoFromStartAndDurationMinutes(
									startsAt,
									preset.minutes
								);
								if (nextEnd) setEndsAt(nextEnd);
							}}
						>
							{t(preset.key)}
						</DesktopAppButton>
					))}
				</div>
			)}
			{canMoveToSelectedDay ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={busy}
					onClick={applyMoveToSelectedDay}
				>
					{t('moveToSelectedDay')}
				</DesktopAppButton>
			) : null}
			<div className="grid gap-3 sm:grid-cols-2">
				<CalendarDateTimeField
					id="calendar-event-starts"
					label={t('fieldStarts')}
					valueIso={startsAt}
					locale={locale}
					dateOnly={allDay}
					dayBoundary="start"
					onChange={applyStartsAt}
				/>
				<CalendarDateTimeField
					id="calendar-event-ends"
					label={t('fieldEnds')}
					valueIso={endsAt}
					locale={locale}
					dateOnly={allDay}
					dayBoundary="end"
					onChange={setEndsAt}
				/>
			</div>
			<div className="flex flex-col gap-1">
				<label
					htmlFor="calendar-event-notes"
					className={DESKTOP_TYPOGRAPHY.caption}
				>
					{t('fieldNotes')}
				</label>
				<textarea
					id="calendar-event-notes"
					className={cn(
						DESKTOP_CHROME_FOCUS_VISIBLE,
						'min-h-20 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)'
					)}
					value={notes}
					onChange={(event) => setNotes(event.target.value)}
				/>
			</div>
			{issue ? (
				<p className={DESKTOP_TYPOGRAPHY.bodyMuted} role="alert">
					{t(`issue.${issue}`)}
				</p>
			) : null}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					{onDuplicate ? (
						<DesktopAppButton
							type="button"
							variant="neutral"
							disabled={busy}
							onClick={() => void onDuplicate()}
						>
							{t(
								kind === 'assistantPlan' ? 'copyAsPersonalEvent' : 'duplicate'
							)}
						</DesktopAppButton>
					) : null}
					{onDelete ? (
						deleteConfirm ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className={DESKTOP_TYPOGRAPHY.caption}>
									{t(
										kind === 'assistantPlan'
											? 'completePlanStepConfirm'
											: 'deleteConfirm'
									)}
								</span>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => setDeleteConfirm(false)}
								>
									{t('cancel')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="danger"
									disabled={busy}
									onClick={() => void onDelete()}
								>
									{t(
										kind === 'assistantPlan'
											? 'completePlanStepConfirmAction'
											: 'deleteConfirmAction'
									)}
								</DesktopAppButton>
							</div>
						) : (
							<DesktopAppButton
								type="button"
								variant="ghost"
								disabled={busy}
								onClick={() => setDeleteConfirm(true)}
							>
								{t(kind === 'assistantPlan' ? 'completePlanStep' : 'delete')}
							</DesktopAppButton>
						)
					) : (
						<span />
					)}
				</div>
				<div className="flex gap-2">
					<DesktopAppButton type="button" variant="ghost" onClick={onCancel}>
						{t('cancel')}
					</DesktopAppButton>
					<DesktopAppButton
						type="submit"
						variant="accent"
						disabled={issue != null || busy}
					>
						{busy ? t('saving') : t('save')}
					</DesktopAppButton>
				</div>
			</div>
		</form>
	);
}
