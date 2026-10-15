/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * List row surface for POEMMA operational screens (ideas, team, customer path).
 *
 * Invariants:
 * - Uses POEMMA_LIST_ROW_SURFACE_CLASS; optional click adds button semantics.
 *
 * Related:
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
	POEMMA_LIST_ROW_SURFACE_CLASS,
	POEMMA_PANEL_INTERACTIVE_CLASS,
} from './poemmaUiClasses';

export type PoemmaListRowProps = {
	children: ReactNode;
	onClick?: () => void;
	className?: string;
};

export function PoemmaListRow({
	children,
	onClick,
	className,
}: PoemmaListRowProps) {
	if (onClick) {
		return (
			<button
				type="button"
				className={cn(
					POEMMA_PANEL_INTERACTIVE_CLASS,
					'p-3 text-left md:p-3',
					className
				)}
				onClick={onClick}
			>
				{children}
			</button>
		);
	}

	return (
		<div className={cn(POEMMA_LIST_ROW_SURFACE_CLASS, className)}>
			{children}
		</div>
	);
}
