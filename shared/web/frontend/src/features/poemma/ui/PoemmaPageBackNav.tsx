/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Consistent back-navigation row for POEMMA sub-flows (ideas, promo, operational pages).
 *
 * Invariants:
 * - Label text is supplied by caller to preserve route-specific copy in tests and UX.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaNavRail.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type PoemmaPageBackNavProps = {
	label: string;
	onNavigate: () => void;
	className?: string;
};

export function PoemmaPageBackNav({
	label,
	onNavigate,
	className,
}: PoemmaPageBackNavProps) {
	return (
		<div className={cn('flex flex-wrap items-center gap-2', className)}>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className="justify-start"
				onClick={onNavigate}
			>
				{label}
			</DesktopAppButton>
		</div>
	);
}
