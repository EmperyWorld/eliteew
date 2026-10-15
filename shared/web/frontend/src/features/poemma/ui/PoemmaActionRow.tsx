/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary/secondary action row with optional helper hint for POEMMA decision screens.
 *
 * Invariants:
 * - Actions slot is opaque ReactNode; pages keep role-specific button labels.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaContextCard.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type PoemmaActionRowProps = {
	actions: ReactNode;
	hint?: string;
	align?: 'start' | 'between';
	className?: string;
};

export function PoemmaActionRow({
	actions,
	hint,
	align = 'start',
	className,
}: PoemmaActionRowProps) {
	return (
		<div
			className={cn(
				'grid gap-2',
				align === 'between' &&
					'flex flex-wrap items-center justify-between gap-3',
				className
			)}
		>
			<div className="flex flex-wrap gap-2">{actions}</div>
			{hint ? (
				<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
					{hint}
				</p>
			) : null}
		</div>
	);
}
