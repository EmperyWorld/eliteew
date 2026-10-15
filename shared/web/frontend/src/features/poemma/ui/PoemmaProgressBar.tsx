/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Accessible progress bar for POEMMA home map and finance goal tracking.
 *
 * Invariants:
 * - `value` is clamped to 0–100 before render; caller supplies percent semantics.
 * - Track/fill colors use desktop CSS variables for theme-safe contrast.
 *
 * Related:
 * - src/features/poemma/home/PoemmaHomePage.tsx
 */

import { cn } from '@/utils/cn';
import {
	POEMMA_PROGRESS_FILL_ACCENT_CLASS,
	POEMMA_PROGRESS_FILL_MUTED_CLASS,
	POEMMA_PROGRESS_TRACK_CLASS,
} from './poemmaUiClasses';

export type PoemmaProgressBarTone = 'accent' | 'muted';

export type PoemmaProgressBarProps = {
	value: number;
	ariaLabel: string;
	tone?: PoemmaProgressBarTone;
	size?: 'sm' | 'md';
	showPercent?: boolean;
	className?: string;
};

function clampPoemmaProgressPercent(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(100, Math.max(0, Math.round(value)));
}

export function PoemmaProgressBar({
	value,
	ariaLabel,
	tone = 'accent',
	size = 'md',
	showPercent = false,
	className,
}: PoemmaProgressBarProps) {
	const clamped = clampPoemmaProgressPercent(value);
	const fillClassName =
		tone === 'muted'
			? POEMMA_PROGRESS_FILL_MUTED_CLASS
			: POEMMA_PROGRESS_FILL_ACCENT_CLASS;

	return (
		<div className={cn('grid gap-2', className)}>
			<div
				className={cn(
					POEMMA_PROGRESS_TRACK_CLASS,
					size === 'sm' ? 'h-2' : 'h-2.5'
				)}
				role="progressbar"
				aria-valuenow={clamped}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={ariaLabel}
			>
				<div className={fillClassName} style={{ width: `${clamped}%` }} />
			</div>
			{showPercent ? (
				<p className="text-base font-semibold tabular-nums text-(--desktop-text-primary)">
					{clamped}%
				</p>
			) : null}
		</div>
	);
}
