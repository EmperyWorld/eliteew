/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step/progress dot row for POEMMA wizards, guide, and alignment summaries.
 *
 * Invariants:
 * - `filled` is clamped to 0…total; accent fill uses desktop accent rgb.
 *
 * Related:
 * - src/features/poemma/onboarding/PoemmaOnboarding.tsx
 * - src/features/poemma/guide/PoemmaGuidePage.tsx
 */

import { cn } from '@/utils/cn';

export type PoemmaStepIndicatorProps = {
	filled: number;
	total: number;
	ariaLabel?: string;
	size?: 'md' | 'sm';
	className?: string;
};

function clampPoemmaStepFilled(filled: number, total: number): number {
	if (!Number.isFinite(filled) || total <= 0) {
		return 0;
	}
	return Math.min(total, Math.max(0, Math.round(filled)));
}

export function PoemmaStepIndicator({
	filled,
	total,
	ariaLabel,
	size = 'md',
	className,
}: PoemmaStepIndicatorProps) {
	const clampedFilled = clampPoemmaStepFilled(filled, total);
	const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

	return (
		<div
			className={cn('flex items-center justify-center gap-2', className)}
			role="progressbar"
			aria-valuenow={clampedFilled}
			aria-valuemin={0}
			aria-valuemax={total}
			aria-label={ariaLabel}
		>
			{Array.from({ length: total }, (_, index) => {
				const stepNumber = index + 1;
				const isFilled = stepNumber <= clampedFilled;
				return (
					<span
						key={`poemma-step-${stepNumber}`}
						className={cn(
							'rounded-full transition-colors',
							dotSize,
							isFilled
								? 'bg-[rgb(var(--desktop-accent-rgb))]'
								: 'bg-(--desktop-border-subtle)'
						)}
						aria-hidden
					/>
				);
			})}
		</div>
	);
}
