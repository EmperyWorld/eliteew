/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact day agenda preview under the taskbar mini month grid.
 *
 * Related:
 * - components/TaskbarClock.tsx
 */

import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import { eventOverlapsLocalDay } from '../../utils/desktopCalendarEventPolicy';
import { isAssistantPlanCalendarItem } from '../../utils/companionPlanCalendarOverlay';
import {
	formatEventScheduleLabel,
	sortCalendarEventsByStart,
} from './calendarAppFormatting';

const PREVIEW_LIMIT = 4;

export type TaskbarMiniCalendarDayPreviewProps = {
	selectedDay: Date;
	events: readonly DesktopCalendarEventResponse[];
	locale: string;
};

export function TaskbarMiniCalendarDayPreview({
	selectedDay,
	events,
	locale,
}: TaskbarMiniCalendarDayPreviewProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const { t: tTaskbar } = useTranslation('desktopUi', { keyPrefix: 'taskbar' });

	const dayEvents = useMemo(
		() =>
			sortCalendarEventsByStart(
				events.filter((event) => eventOverlapsLocalDay(event, selectedDay))
			),
		[events, selectedDay]
	);

	const heading = selectedDay.toLocaleDateString(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
	});

	if (dayEvents.length === 0) {
		return (
			<div className="mt-3 border-t border-(--desktop-border-subtle) pt-3">
				<p className={DESKTOP_TYPOGRAPHY.caption}>{heading}</p>
				<p className={DESKTOP_TYPOGRAPHY.bodyMuted}>
					{tTaskbar('clockMiniCalendarEmptyDay')}
				</p>
			</div>
		);
	}

	const visible = dayEvents.slice(0, PREVIEW_LIMIT);
	const hiddenCount = dayEvents.length - visible.length;

	return (
		<div className="mt-3 border-t border-(--desktop-border-subtle) pt-3">
			<p className={DESKTOP_TYPOGRAPHY.caption}>
				{heading} · {t('eventCount', { count: dayEvents.length })}
			</p>
			<ul className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto">
				{visible.map((event) => {
					const planItem = isAssistantPlanCalendarItem(event.id);
					const schedule = formatEventScheduleLabel(event, locale, t('allDay'));
					return (
						<li
							key={event.id}
							className="flex items-start gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) px-2 py-1.5"
						>
							<span
								className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
									planItem
										? 'bg-[hsl(198_72%_42%)]'
										: 'bg-[rgb(var(--desktop-accent-rgb))]'
								}`}
								aria-hidden
							/>
							<div className="min-w-0 flex-1">
								<p className={`${DESKTOP_TYPOGRAPHY.caption} truncate`}>
									{event.title}
								</p>
								{schedule ? (
									<p
										className={`${DESKTOP_TYPOGRAPHY.caption} text-(--desktop-text-muted)`}
									>
										{schedule}
										{planItem ? ` · ${t('assistantPlanBadge')}` : null}
									</p>
								) : planItem ? (
									<p
										className={`${DESKTOP_TYPOGRAPHY.caption} text-(--desktop-text-muted)`}
									>
										{t('assistantPlanBadge')}
									</p>
								) : null}
							</div>
						</li>
					);
				})}
			</ul>
			{hiddenCount > 0 ? (
				<p
					className={`${DESKTOP_TYPOGRAPHY.caption} mt-1 text-(--desktop-text-muted)`}
				>
					{t('moreEvents', { count: hiddenCount })}
				</p>
			) : null}
		</div>
	);
}
