/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Top navigation rail with back action and optional trailing controls for POEMMA pages.
 *
 * Invariants:
 * - Back label is caller-defined; rail does not perform routing itself.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPageBackNav.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { POEMMA_NAV_RAIL_CLASS } from './poemmaUiClasses';
import { PoemmaPageBackNav } from './PoemmaPageBackNav';

export type PoemmaNavRailProps = {
	backLabel: string;
	onBack: () => void;
	trailing?: ReactNode;
	className?: string;
};

export function PoemmaNavRail({
	backLabel,
	onBack,
	trailing,
	className,
}: PoemmaNavRailProps) {
	return (
		<div className={cn(POEMMA_NAV_RAIL_CLASS, className)}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<PoemmaPageBackNav label={backLabel} onNavigate={onBack} />
				{trailing ? (
					<div className="flex flex-wrap items-center gap-2">{trailing}</div>
				) : null}
			</div>
		</div>
	);
}
