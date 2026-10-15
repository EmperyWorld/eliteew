/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Uppercase micro-hint line for Professional Worlds panels (replaces ad-hoc 11px labels).
 *
 * Invariants:
 * - Single typography token for coach/brand field hints.
 *
 * Related:
 * - layout/professionalWorldsLayoutTokens.ts
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export function ProfessionalWorldsInlineHint({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				'text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-muted)',
				className
			)}
		>
			{children}
		</span>
	);
}
