/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contextual callout card for empty states, branch prompts, and “what next” guidance.
 *
 * Invariants:
 * - Title and body are caller-defined; card does not embed navigation logic.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaActionRow.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
	POEMMA_CONTEXT_CARD_CLASS,
	POEMMA_SECTION_TITLE_CLASS,
} from './poemmaUiClasses';

export type PoemmaContextCardProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
};

export function PoemmaContextCard({
	title,
	description,
	actions,
	className,
}: PoemmaContextCardProps) {
	return (
		<div className={cn(POEMMA_CONTEXT_CARD_CLASS, className)}>
			<p className={POEMMA_SECTION_TITLE_CLASS}>{title}</p>
			{description ? (
				<p className="text-base leading-7 text-(--desktop-text-secondary)">
					{description}
				</p>
			) : null}
			{actions ? (
				<div className="flex flex-wrap gap-2 pt-1">{actions}</div>
			) : null}
		</div>
	);
}
