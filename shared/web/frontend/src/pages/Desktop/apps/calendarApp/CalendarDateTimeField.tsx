/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CalendarApp datetime control with mini month popover (replaces bare datetime-local).
 *
 * Invariants:
 * - Popover mounts through Shell portal — not clipped by workspace overflow-y-auto.
 *
 * Related:
 * - CalendarEventEditor.tsx
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
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
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppInput,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopPopoverOpenGuard } from '@/pages/Desktop/hooks/useDesktopPopoverOpenGuard';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import { getFloatingMenuPosition } from '@/pages/Desktop/utils/desktopUi';
import { cn } from '@/utils/cn';
import {
	parseCalendarInstant,
	startOfLocalDay,
} from '../../utils/desktopCalendarEventPolicy';
import { CalendarMiniMonthGrid } from './CalendarMiniMonthGrid';
import {
	formatDateTimeFieldLabel,
	mergeLocalDateWithTime,
} from './calendarAppFormatting';

const POPOVER_WIDTH_PX = 288;
const POPOVER_HEIGHT_DATE_ONLY_PX = 300;
const POPOVER_HEIGHT_WITH_TIME_PX = 440;

export type CalendarDateTimeFieldProps = {
	id: string;
	label: string;
	valueIso: string;
	locale: string;
	disabled?: boolean;
	dateOnly?: boolean;
	dayBoundary?: 'start' | 'end';
	onChange: (iso: string) => void;
};

function formatFieldLabel(
	iso: string,
	locale: string,
	dateOnly: boolean
): string {
	const date = parseCalendarInstant(iso);
	if (!date) return '—';
	if (dateOnly) {
		return date.toLocaleDateString(locale, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}
	return formatDateTimeFieldLabel(iso, locale);
}

function isoForDayBoundary(day: Date, boundary: 'start' | 'end'): string {
	if (boundary === 'end') {
		return new Date(
			day.getFullYear(),
			day.getMonth(),
			day.getDate(),
			23,
			59,
			0,
			0
		).toISOString();
	}
	return startOfLocalDay(day).toISOString();
}

function toTimeParts(iso: string): { hours: number; minutes: number } {
	const date = parseCalendarInstant(iso) ?? new Date(iso);
	return {
		hours: Number.isFinite(date.getTime()) ? date.getHours() : 9,
		minutes: Number.isFinite(date.getTime()) ? date.getMinutes() : 0,
	};
}

export function CalendarDateTimeField({
	id,
	label,
	valueIso,
	locale,
	disabled = false,
	dateOnly = false,
	dayBoundary = 'start',
	onChange,
}: CalendarDateTimeFieldProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const openGuardRef = useDesktopPopoverOpenGuard(open);
	const { Portal, portalProps } = useShellPortal({
		layer: 'embedded_popover',
		appComponent: 'CalendarApp',
		dismissOnEscape: false,
		trapFocus: false,
		onDismiss: () => setOpen(false),
	});
	const parsed = parseCalendarInstant(valueIso) ?? new Date(valueIso);
	const anchor = Number.isFinite(parsed.getTime()) ? parsed : new Date();
	const [viewMonth, setViewMonth] = useState(() => startOfLocalDay(anchor));
	const [timeParts, setTimeParts] = useState(() => toTimeParts(valueIso));
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

	const popoverHeight = dateOnly
		? POPOVER_HEIGHT_DATE_ONLY_PX
		: POPOVER_HEIGHT_WITH_TIME_PX;

	const syncAnchorRect = useCallback(() => {
		if (!triggerRef.current) return;
		setAnchorRect(triggerRef.current.getBoundingClientRect());
	}, []);

	useEffect(() => {
		if (!open) return;
		const parsedValue = parseCalendarInstant(valueIso) ?? new Date(valueIso);
		if (Number.isFinite(parsedValue.getTime())) {
			setViewMonth(
				new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1)
			);
			setTimeParts(toTimeParts(valueIso));
		}
		syncAnchorRect();
	}, [open, syncAnchorRect, valueIso]);

	useEffect(() => {
		if (!open) return;
		const onLayout = () => syncAnchorRect();
		window.addEventListener('resize', onLayout);
		window.addEventListener('scroll', onLayout, true);
		return () => {
			window.removeEventListener('resize', onLayout);
			window.removeEventListener('scroll', onLayout, true);
		};
	}, [open, syncAnchorRect]);

	useEffect(() => {
		if (!open) return;
		const close = (event: MouseEvent | PointerEvent) => {
			if (openGuardRef.current) return;
			const target = event.target as Node | null;
			if (panelRef.current?.contains(target)) return;
			if (triggerRef.current?.contains(target)) return;
			setOpen(false);
		};
		window.addEventListener('mousedown', close, { capture: true });
		window.addEventListener('pointerdown', close, { capture: true });
		return () => {
			window.removeEventListener('mousedown', close, { capture: true });
			window.removeEventListener('pointerdown', close, { capture: true });
		};
	}, [open, openGuardRef]);

	const popoverPos = useMemo(() => {
		if (!open || !anchorRect) return null;
		return getFloatingMenuPosition(
			{ x: anchorRect.left, y: anchorRect.bottom + 4 },
			{
				menuWidth: POPOVER_WIDTH_PX,
				menuHeight: popoverHeight,
				preferAbove: false,
				anchorGap: 4,
			}
		);
	}, [anchorRect, open, popoverHeight]);

	const applyTime = (day: Date, hours: number, minutes: number) => {
		const merged = mergeLocalDateWithTime(
			day,
			new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
		);
		onChange(merged.toISOString());
		setTimeParts({ hours, minutes });
	};

	const quickTimes = [
		{ hours: 9, label: '09:00' },
		{ hours: 12, label: '12:00' },
		{ hours: 18, label: '18:00' },
	];

	return (
		<div className="flex flex-col gap-1">
			<span className={DESKTOP_TYPOGRAPHY.caption} id={`${id}-label`}>
				{label}
			</span>
			<button
				ref={triggerRef}
				id={id}
				type="button"
				disabled={disabled}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-labelledby={`${id}-label`}
				className={cn(
					DESKTOP_CHROME_FOCUS_VISIBLE,
					'flex w-full items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-left text-sm text-(--desktop-text-primary) transition-colors hover:bg-(--desktop-surface-soft-hover) disabled:cursor-not-allowed disabled:opacity-50'
				)}
				onClick={() => setOpen((value) => !value)}
			>
				<CalendarDaysIcon
					className="h-4 w-4 shrink-0 text-(--desktop-text-muted)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				<span className="min-w-0 flex-1 truncate">
					{formatFieldLabel(valueIso, locale, dateOnly)}
				</span>
			</button>
			{open && popoverPos ? (
				<Portal>
					<div
						ref={panelRef}
						role="dialog"
						aria-label={t('pickDateTime')}
						className="fixed w-[min(100vw-1rem,18rem)] rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-3 shadow-lg"
						style={{
							left: popoverPos.x,
							top: popoverPos.y,
							zIndex: portalProps?.zIndex,
						}}
						onMouseDown={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
					>
						<CalendarMiniMonthGrid
							viewMonth={viewMonth}
							selectedDay={anchor}
							today={startOfLocalDay(new Date())}
							locale={locale}
							compact
							onViewMonthChange={setViewMonth}
							onSelectDay={(day) => {
								if (dateOnly) {
									onChange(isoForDayBoundary(day, dayBoundary));
									setOpen(false);
									return;
								}
								applyTime(day, timeParts.hours, timeParts.minutes);
							}}
						/>
						{dateOnly ? null : (
							<div className="mt-3 flex flex-col gap-2 border-t border-(--desktop-border-subtle) pt-3">
								<div className="flex flex-wrap gap-1">
									{quickTimes.map((slot) => (
										<DesktopAppButton
											key={slot.hours}
											type="button"
											size="sm"
											variant="ghost"
											onClick={() => applyTime(anchor, slot.hours, 0)}
										>
											{slot.label}
										</DesktopAppButton>
									))}
								</div>
								<div className="flex items-end gap-2">
									<div className="flex flex-1 flex-col gap-1">
										<label
											htmlFor={`${id}-hours`}
											className={DESKTOP_TYPOGRAPHY.caption}
										>
											{t('fieldHours')}
										</label>
										<DesktopAppInput
											id={`${id}-hours`}
											type="number"
											min={0}
											max={23}
											value={timeParts.hours}
											onChange={(event) => {
												const hours = Math.min(
													23,
													Math.max(0, Number(event.target.value) || 0)
												);
												setTimeParts((prev) => ({ ...prev, hours }));
												applyTime(anchor, hours, timeParts.minutes);
											}}
										/>
									</div>
									<span className="pb-2 text-(--desktop-text-muted)">:</span>
									<div className="flex flex-1 flex-col gap-1">
										<label
											htmlFor={`${id}-minutes`}
											className={DESKTOP_TYPOGRAPHY.caption}
										>
											{t('fieldMinutes')}
										</label>
										<DesktopAppInput
											id={`${id}-minutes`}
											type="number"
											min={0}
											max={59}
											value={timeParts.minutes}
											onChange={(event) => {
												const minutes = Math.min(
													59,
													Math.max(0, Number(event.target.value) || 0)
												);
												setTimeParts((prev) => ({ ...prev, minutes }));
												applyTime(anchor, timeParts.hours, minutes);
											}}
										/>
									</div>
								</div>
							</div>
						)}
						<div className="mt-2 flex justify-end">
							<DesktopAppButton
								type="button"
								size="sm"
								variant="accent"
								onClick={() => setOpen(false)}
							>
								{t('done')}
							</DesktopAppButton>
						</div>
					</div>
				</Portal>
			) : null}
		</div>
	);
}
