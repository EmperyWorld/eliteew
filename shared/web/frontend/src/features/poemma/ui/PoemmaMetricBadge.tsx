/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact metric/status pill for POEMMA top bars, headers, and inline summaries.
 *
 * Invariants:
 * - Tone maps to semantic color only; label text is caller-defined Russian copy.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaStatusStack.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type PoemmaMetricBadgeTone =
	| 'neutral'
	| 'accent'
	| 'success'
	| 'info'
	| 'warning'
	| 'danger';

const TONE_CLASS: Record<PoemmaMetricBadgeTone, string> = {
	neutral:
		'border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_65%,var(--desktop-surface-panel))] text-(--desktop-text-secondary)',
	accent:
		'border-[rgb(var(--desktop-accent-rgb)/0.38)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)',
	success:
		'border-[color-mix(in_srgb,rgb(16_185_129)_38%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(16_185_129)_14%,var(--desktop-surface-panel))] text-[color-mix(in_srgb,rgb(16_185_129)_72%,var(--desktop-text-primary))]',
	info: 'border-[color-mix(in_srgb,rgb(14_165_233)_38%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(14_165_233)_14%,var(--desktop-surface-panel))] text-[color-mix(in_srgb,rgb(14_165_233)_72%,var(--desktop-text-primary))]',
	warning:
		'border-[color-mix(in_srgb,rgb(245_158_11)_40%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(245_158_11)_14%,var(--desktop-surface-panel))] text-[color-mix(in_srgb,rgb(245_158_11)_78%,var(--desktop-text-primary))]',
	danger:
		'border-[color-mix(in_srgb,rgb(239_68_68)_38%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_12%,var(--desktop-surface-panel))] text-[color-mix(in_srgb,rgb(239_68_68)_72%,var(--desktop-text-primary))]',
};

export type PoemmaMetricBadgeProps = {
	label: string;
	tone?: PoemmaMetricBadgeTone;
	title?: string;
	icon?: ReactNode;
	className?: string;
	/** `chip` — readable sentence case for users; `status` — compact uppercase pill. */
	variant?: 'chip' | 'status';
};

export function PoemmaMetricBadge({
	label,
	tone = 'neutral',
	title,
	icon,
	className,
	variant = 'chip',
}: PoemmaMetricBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-(--desktop-radius-lg) border',
				variant === 'status'
					? 'rounded-full px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.08em]'
					: 'px-3 py-1.5 text-xs font-medium leading-snug',
				TONE_CLASS[tone],
				className
			)}
			title={title}
		>
			{icon}
			{label}
		</span>
	);
}
