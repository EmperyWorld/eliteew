/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact draggable event chip for CalendarApp grid cells.
 *
 * Related:
 * - CalendarGridPanel.tsx
 */

import type { CSSProperties, DragEvent, ReactElement } from 'react';
import { cn } from '@/utils/cn';
import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import {
	calendarEventAccentStyle,
	formatEventChipLabel,
} from './calendarAppFormatting';

export const CALENDAR_EVENT_DRAG_MIME =
	'application/x-eliteew-calendar-event-id';

export type CalendarEventChipProps = {
	event: DesktopCalendarEventResponse;
	locale: string;
	cellDay: Date;
	isContinuation: boolean;
	continuedLabel: string;
	onClick: () => void;
};

export function CalendarEventChip({
	event,
	locale,
	cellDay,
	isContinuation,
	continuedLabel,
	onClick,
}: CalendarEventChipProps): ReactElement {
	const accentStyle = calendarEventAccentStyle(event.id) as CSSProperties;
	const planChip = event.id.startsWith('assistant-plan:');
	const label = formatEventChipLabel(event, locale, {
		isContinuation,
		continuedLabel,
	});
	const dayLabel = cellDay.toLocaleDateString(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
	});

	const onDragStart = (dragEvent: DragEvent<HTMLButtonElement>) => {
		dragEvent.dataTransfer.setData(CALENDAR_EVENT_DRAG_MIME, event.id);
		dragEvent.dataTransfer.effectAllowed = 'move';
	};

	return (
		<button
			type="button"
			draggable
			title={label}
			className={cn(
				'truncate rounded-(--desktop-radius) border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight text-(--desktop-text-primary) transition-[filter,transform] hover:brightness-110 active:scale-[0.98]',
				isContinuation && 'opacity-90 italic',
				planChip && 'border-dashed'
			)}
			style={accentStyle}
			onClick={(clickEvent) => {
				clickEvent.stopPropagation();
				onClick();
			}}
			onDragStart={onDragStart}
		>
			<span className="sr-only">{dayLabel}</span>
			{label}
		</button>
	);
}
