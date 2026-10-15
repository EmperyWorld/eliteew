/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Day agenda panel: sorted event list or inline editor for CalendarApp.
 *
 * Related:
 * - CalendarApp.tsx
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppListRow,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { isAssistantPlanCalendarItem } from '../../utils/companionPlanCalendarOverlay';
import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import type { EventRelativeStatus } from '../../utils/desktopCalendarEventPolicy';
import {
	localDayKey,
	parseCalendarInstantMs,
	resolveEventRelativeStatus,
	timedEventsOverlapOnDay,
} from '../../utils/desktopCalendarEventPolicy';
import { CalendarEventEditor } from './CalendarEventEditor';
import {
	calendarEventAccentBorderStyle,
	formatEventScheduleLabel,
	truncateNotesPreview,
} from './calendarAppFormatting';

export type CalendarDayAgendaPanelProps = {
	selectedDay: Date;
	today: Date;
	locale: string;
	events: DesktopCalendarEventResponse[];
	editor:
		| null
		| { mode: 'create' }
		| { mode: 'edit'; event: DesktopCalendarEventResponse };
	busy: boolean;
	onOpenCreate: () => void;
	onOpenEdit: (event: DesktopCalendarEventResponse) => void;
	onCloseEditor: () => void;
	onSave: (draft: {
		title: string;
		notes: string;
		starts_at: string;
		ends_at: string;
		all_day: boolean;
	}) => Promise<void>;
	onDelete: (eventId: string) => Promise<void>;
	onDuplicate?: (event: DesktopCalendarEventResponse) => Promise<void>;
	searchActive?: boolean;
	dayHasUnfilteredEvents?: boolean;
};

export function CalendarDayAgendaPanel({
	selectedDay,
	today,
	locale,
	events,
	editor,
	busy,
	onOpenCreate,
	onOpenEdit,
	onCloseEditor,
	onSave,
	onDelete,
	onDuplicate,
	searchActive = false,
	dayHasUnfilteredEvents = false,
}: CalendarDayAgendaPanelProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const editingId = editor?.mode === 'edit' ? editor.event.id : null;
	const isSelectedToday = localDayKey(selectedDay) === localDayKey(today);
	const now = new Date();

	const relativeLabel = (
		status: EventRelativeStatus,
		event: DesktopCalendarEventResponse
	): string => {
		if (status === 'in_progress') return t('relativeInProgress');
		if (status === 'ended') return t('relativeEnded');
		const start = parseCalendarInstantMs(event.starts_at);
		const minutes = Number.isFinite(start)
			? Math.max(1, Math.round((start - now.getTime()) / 60_000))
			: 1;
		return t('relativeUpcoming', { count: minutes });
	};

	return (
		<DesktopAppSurface variant="panelStrong" padding="md" className="h-full">
			<DesktopAppSectionLabel>{t('agendaLabel')}</DesktopAppSectionLabel>
			{editor ? (
				<div className="mt-3">
					<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'mb-3')}>
						{editor.mode === 'edit'
							? isAssistantPlanCalendarItem(editor.event.id)
								? t('editPlanStepTitle')
								: t('editEventTitle')
							: t('createEventTitle')}
					</p>
					<CalendarEventEditor
						initial={editor.mode === 'edit' ? editor.event : null}
						defaultDay={selectedDay}
						locale={locale}
						busy={busy}
						kind={
							editor.mode === 'edit' &&
							isAssistantPlanCalendarItem(editor.event.id)
								? 'assistantPlan'
								: 'personal'
						}
						onCancel={onCloseEditor}
						onSave={onSave}
						onDelete={
							editor.mode === 'edit'
								? async () => {
										await onDelete(editor.event.id);
									}
								: undefined
						}
						onDuplicate={
							editor.mode === 'edit' && onDuplicate
								? async () => {
										await onDuplicate(editor.event);
									}
								: undefined
						}
					/>
				</div>
			) : events.length === 0 ? (
				<div className="mt-3">
					<DesktopAppEmptyState
						title={
							searchActive && dayHasUnfilteredEvents
								? t('searchNoResultsTitle')
								: t('emptyDayTitle')
						}
						description={
							searchActive && dayHasUnfilteredEvents
								? t('searchNoResultsBody')
								: t('emptyDayBody')
						}
					>
						<DesktopAppButton variant="accent" onClick={onOpenCreate}>
							{t('newEvent')}
						</DesktopAppButton>
					</DesktopAppEmptyState>
				</div>
			) : (
				<ul className="mt-3 flex flex-col gap-2">
					{events.map((event) => {
						const notesPreview = truncateNotesPreview(event.notes ?? '');
						const schedule = formatEventScheduleLabel(
							event,
							locale,
							t('allDay')
						);
						const planItem = isAssistantPlanCalendarItem(event.id);
						const accentStyle = calendarEventAccentBorderStyle(event.id);
						const relativeStatus = isSelectedToday
							? resolveEventRelativeStatus(event, now)
							: null;
						const hasOverlap = events.some(
							(other) =>
								other.id !== event.id &&
								timedEventsOverlapOnDay(event, other, selectedDay)
						);
						return (
							<li key={event.id}>
								<DesktopAppListRow
									className="w-full flex-col items-start gap-1 border-l-[3px] px-3 py-2 text-left"
									style={accentStyle}
									active={editingId === event.id}
									onClick={() => onOpenEdit(event)}
								>
									<div className="flex w-full flex-wrap items-center gap-2">
										<span className={DESKTOP_TYPOGRAPHY.body}>
											{event.title}
										</span>
										{planItem ? (
											<span
												className={cn(
													DESKTOP_TYPOGRAPHY.caption,
													'rounded-(--desktop-radius) border border-dashed border-[hsl(198_72%_38%)] px-1.5 py-0.5 text-[hsl(198_72%_32%)]'
												)}
											>
												{t('assistantPlanBadge')}
											</span>
										) : null}
										{relativeStatus ? (
											<span
												className={cn(
													DESKTOP_TYPOGRAPHY.caption,
													'rounded-(--desktop-radius) bg-(--desktop-surface-soft) px-1.5 py-0.5',
													relativeStatus === 'in_progress' &&
														'text-[rgb(var(--desktop-accent-rgb))]',
													relativeStatus === 'ended' &&
														'text-(--desktop-text-muted)'
												)}
											>
												{relativeLabel(relativeStatus, event)}
											</span>
										) : null}
									</div>
									{schedule ? (
										<span className={DESKTOP_TYPOGRAPHY.caption}>
											{schedule}
										</span>
									) : null}
									{notesPreview ? (
										<span className={DESKTOP_TYPOGRAPHY.bodyMuted}>
											{notesPreview}
										</span>
									) : null}
									{hasOverlap ? (
										<span className={DESKTOP_TYPOGRAPHY.caption}>
											{t('overlapHint')}
										</span>
									) : null}
								</DesktopAppListRow>
							</li>
						);
					})}
				</ul>
			)}
		</DesktopAppSurface>
	);
}
