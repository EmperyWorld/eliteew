/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dashboard metric tile for Professional Worlds overview pulse.
 *
 * Invariants:
 * - Presentation-only; values computed by parent.
 * - Optional `onNavigate` turns the tile into a keyboard-accessible jump control.
 *
 * Related:
 * - OverviewWorkspacePanel.tsx
 */

import { DesktopAppSurface } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export function ProfessionalWorldsMetricCard({
	label,
	value,
	helper,
	onNavigate,
	navigateLabel,
}: {
	label: string;
	value: string | number;
	helper: string;
	onNavigate?: () => void;
	navigateLabel?: string;
}) {
	const body = (
		<DesktopAppSurface
			variant="soft"
			padding="md"
			className={cn('grid gap-2', onNavigate && 'transition hover:bg-white/5')}
		>
			<span className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-muted)">
				{label}
			</span>
			<strong className="text-2xl text-(--desktop-text-primary)">
				{value}
			</strong>
			<span className="text-xs text-(--desktop-text-secondary)">{helper}</span>
			{onNavigate && navigateLabel ? (
				<span className="text-xs text-(--desktop-accent)">{navigateLabel}</span>
			) : null}
		</DesktopAppSurface>
	);

	if (!onNavigate) {
		return body;
	}

	return (
		<button
			type="button"
			className="cursor-pointer rounded-(--desktop-radius) text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--desktop-accent)"
			onClick={onNavigate}
		>
			{body}
		</button>
	);
}
