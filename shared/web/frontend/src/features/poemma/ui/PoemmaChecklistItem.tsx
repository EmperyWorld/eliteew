/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single checklist row for POEMMA home alignment and similar summary lists.
 *
 * Invariants:
 * - Done state uses accent fill; pending uses bordered neutral circle.
 *
 * Related:
 * - src/features/poemma/home/PoemmaHomePage.tsx
 */

import { cn } from '@/utils/cn';
import {
	POEMMA_CHECKLIST_DONE_CLASS,
	POEMMA_CHECKLIST_PENDING_CLASS,
} from './poemmaUiClasses';

export type PoemmaChecklistItemProps = {
	label: string;
	done: boolean;
	className?: string;
};

export function PoemmaChecklistItem({
	label,
	done,
	className,
}: PoemmaChecklistItemProps) {
	return (
		<li
			className={cn(
				'flex items-center gap-2 text-base font-medium text-(--desktop-text-primary)',
				className
			)}
		>
			<span
				className={
					done ? POEMMA_CHECKLIST_DONE_CLASS : POEMMA_CHECKLIST_PENDING_CLASS
				}
				aria-hidden
			>
				{done ? '✓' : '○'}
			</span>
			<span>{label}</span>
		</li>
	);
}
