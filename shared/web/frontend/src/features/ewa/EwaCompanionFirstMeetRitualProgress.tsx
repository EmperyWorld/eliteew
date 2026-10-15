/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Subtle ritual progress indicator for the EWA companion first-meet legend (RESONANCE flow).
 *
 * Invariants:
 * - `current` is 1-based and clamped to `total`; visual fill reflects current / total.
 * - Exposes `role="progressbar"` for screen readers when `ariaLabel` is provided.
 *
 * Related:
 * - src/features/ewa/EwaCompanionFirstMeet.tsx
 */
import { cn } from '@/utils/cn';

export function EwaCompanionFirstMeetRitualProgress({
	current,
	total,
	ariaLabel,
	className,
}: {
	current: number;
	total: number;
	ariaLabel: string;
	className?: string;
}) {
	const clampedCurrent = Math.min(Math.max(current, 0), total);
	const pct = total > 0 ? (clampedCurrent / total) * 100 : 0;

	return (
		<div
			className={cn('px-0.5', className)}
			role="progressbar"
			aria-valuenow={clampedCurrent}
			aria-valuemin={0}
			aria-valuemax={total}
			aria-label={ariaLabel}
		>
			<div className="h-px overflow-hidden rounded-full bg-white/10">
				<div
					className={cn(
						'h-full rounded-full',
						'motion-safe:transition-[width] motion-safe:duration-500 motion-reduce:transition-none',
						'bg-linear-to-r from-[rgb(var(--desktop-accent-rgb)/0.75)] via-[rgb(var(--desktop-accent-rgb)/0.45)] to-white/65',
						'shadow-[0_0_14px_rgba(168,85,247,0.45)]'
					)}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}
