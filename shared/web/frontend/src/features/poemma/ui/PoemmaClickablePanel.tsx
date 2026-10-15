/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive panel surface for POEMMA home map tiles and navigable summaries.
 *
 * Invariants:
 * - Uses button semantics when onClick is provided; otherwise renders static div.
 *
 * Related:
 * - src/features/poemma/home/PoemmaHomePage.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { POEMMA_PANEL_INTERACTIVE_CLASS } from './poemmaUiClasses';

export type PoemmaClickablePanelProps = {
	children: ReactNode;
	onClick?: () => void;
	className?: string;
};

export function PoemmaClickablePanel({
	children,
	onClick,
	className,
}: PoemmaClickablePanelProps) {
	if (onClick) {
		return (
			<button
				type="button"
				className={cn(POEMMA_PANEL_INTERACTIVE_CLASS, className)}
				onClick={onClick}
			>
				{children}
			</button>
		);
	}

	return (
		<div className={cn(POEMMA_PANEL_INTERACTIVE_CLASS, className)}>
			{children}
		</div>
	);
}
