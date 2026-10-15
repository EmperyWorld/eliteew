/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Horizontal stack of POEMMA metric badges for sync/period/context summaries.
 *
 * Invariants:
 * - Children order reflects caller priority (sync before period, etc.).
 *
 * Related:
 * - src/features/poemma/ui/PoemmaMetricBadge.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type PoemmaStatusStackProps = {
	children: ReactNode;
	className?: string;
};

export function PoemmaStatusStack({
	children,
	className,
}: PoemmaStatusStackProps) {
	return (
		<div
			className={cn('flex flex-wrap items-center justify-end gap-2', className)}
		>
			{children}
		</div>
	);
}
