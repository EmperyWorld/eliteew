import { cn } from '@/utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import * as React from 'react';

/*
 * Marketing cabinet — interactive dashboard tile chrome (header + scrollable body).
 *
 * UX contract (plan §6 / product dashboard spec):
 *
 * 1. Anatomy
 *    - Header: primary title (section label) and optional badge; `headerActions` is for
 *      shell controls (hide / lock / delete) — do not duplicate those inside widget bodies.
 *    - Body: `min-h-0` `flex-1` `overflow-y-auto`. Charts: parent with explicit min-height
 *      (e.g. min-h-[200px]) so the tile does not collapse.
 *    - Optional `footer`: link to full section — visually weaker than in-place actions.
 *
 * 2. Density — comfortable (default) vs compact (tighter padding, text-xs in body).
 *
 * 3. States — loading / empty / error inside the body; keep chrome stable; prefer skeleton.
 *
 * 4. Drag vs interactive — ReactGridLayout `draggableCancel` includes `.mc-dashboard-no-drag`
 *    (`MC_DASHBOARD_NO_DRAG_CLASS`) on controls so drag does not steal clicks.
 *
 * 5. Motion / charts — prefers-reduced-motion; Recharts ResponsiveContainer; legible axes;
 *    tooltips not clipped by body overflow (z-index / padding).
 *
 * 6. Accessibility — section + `tileAriaLabel` when needed; i18n for labels and titles.
 *
 * 7. Wave 23 — use `mcDashboardTileChromeActionBtnClassName` (and danger/hint variants) for
 *    all header icon buttons so pin/hide/remove/resize/menu stay visually consistent.
 */
export const MC_DASHBOARD_NO_DRAG_CLASS = 'mc-dashboard-no-drag' as const;

/** Unified touch target + ghost styling for tile header icon buttons (Wave 23 / D.38). */
export const mcDashboardTileChromeActionBtnClassName = cn(
	MC_DASHBOARD_NO_DRAG_CLASS,
	DESKTOP_INTERACTIVE.btn,
	'min-h-11 min-w-11 sm:h-8 sm:w-8 sm:min-h-8 sm:min-w-8 rounded-(--desktop-radius) p-0'
);

export const mcDashboardTileChromeDangerBtnClassName = cn(
	MC_DASHBOARD_NO_DRAG_CLASS,
	DESKTOP_INTERACTIVE.btnDanger,
	'min-h-11 min-w-11 sm:h-8 sm:w-8 sm:min-h-8 sm:min-w-8 rounded-(--desktop-radius) p-0 text-(--desktop-text-muted)'
);

export const mcDashboardTileChromeHintBtnClassName = cn(
	MC_DASHBOARD_NO_DRAG_CLASS,
	DESKTOP_INTERACTIVE.btn,
	'-mr-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-(--desktop-radius) text-(--desktop-text-dim) hover:bg-(--desktop-surface-panel)/50 hover:text-(--desktop-text-secondary) sm:h-8 sm:w-8'
);

export type McDashboardTileDensity = 'comfortable' | 'compact';

export interface TileChromeProps {
	title: React.ReactNode;
	/** Optional count or short label (e.g. open alerts). */
	badge?: React.ReactNode;
	/** Right side of the header (shell actions: hide, lock, remove, …). */
	headerActions?: React.ReactNode;
	/**
	 * Fixed strip under the header (e.g. list tile filters) — not inside the scrollable body.
	 */
	belowHeader?: React.ReactNode;
	/** Main widget content; scrolls within the tile. */
	children: React.ReactNode;
	/** Weaker row under the body (e.g. link to full section). */
	footer?: React.ReactNode;
	density?: McDashboardTileDensity;
	className?: string;
	headerClassName?: string;
	bodyClassName?: string;
	footerClassName?: string;
	/** Accessible name for the tile region when needed beyond visible title. */
	tileAriaLabel?: string;
	/** Optional guided-tour anchor (e.g. first tile chrome). */
	dataMcGuide?: string;
}

const densityRoot: Record<McDashboardTileDensity, string> = {
	comfortable: 'p-3',
	compact: 'p-2',
};

const densityHeader: Record<McDashboardTileDensity, string> = {
	comfortable: 'mb-2',
	compact: 'mb-1.5',
};

const densityBodyType: Record<McDashboardTileDensity, string> = {
	comfortable: '',
	compact: 'text-xs',
};

export const TileChrome: React.FC<TileChromeProps> = ({
	title,
	badge,
	headerActions,
	belowHeader,
	children,
	footer,
	density = 'comfortable',
	className,
	headerClassName,
	bodyClassName,
	footerClassName,
	tileAriaLabel,
	dataMcGuide,
}) => {
	const d = density;
	return (
		<section
			aria-label={tileAriaLabel ?? undefined}
			data-mc-guide={dataMcGuide}
			className={cn(
				'flex h-full min-h-0 flex-col overflow-hidden',
				densityRoot[d],
				className
			)}
		>
			<div
				className={cn(
					'flex shrink-0 items-start justify-between gap-2',
					densityHeader[d],
					headerClassName
				)}
			>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					<DesktopAppSectionLabel className="min-w-0">
						{title}
					</DesktopAppSectionLabel>
					{badge != null && badge !== '' ? (
						<span
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.counterBadge,
								'shrink-0 border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
							)}
						>
							{badge}
						</span>
					) : null}
				</div>
				{headerActions ? (
					<div className="flex shrink-0 items-center gap-0.5">
						{headerActions}
					</div>
				) : null}
			</div>
			{belowHeader ? (
				<div
					className={cn(
						'min-w-0 shrink-0',
						d === 'compact' ? 'mb-1.5' : 'mb-2'
					)}
				>
					{belowHeader}
				</div>
			) : null}
			<div
				className={cn(
					'min-h-0 flex-1 overflow-y-auto pr-0.5',
					densityBodyType[d],
					bodyClassName
				)}
			>
				{children}
			</div>
			{footer ? (
				<div
					className={cn(
						'mt-2 shrink-0 border-t border-(--desktop-border-subtle)/80 pt-2',
						DESKTOP_TYPOGRAPHY.meta,
						d === 'compact' && 'mt-1.5 pt-1.5',
						footerClassName
					)}
				>
					{footer}
				</div>
			) : null}
		</section>
	);
};
