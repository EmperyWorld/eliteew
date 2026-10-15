/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pill navigation chip for POEMMA app top bar route shortcuts.
 *
 * Invariants:
 * - Active state uses accent fill; inactive uses shared hover/focus ring tokens.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaTopBar.tsx
 */

import { cn } from '@/utils/cn';
import {
	POEMMA_TOP_NAV_CHIP_ACTIVE_CLASS,
	POEMMA_TOP_NAV_CHIP_INACTIVE_CLASS,
} from './poemmaUiClasses';

export type PoemmaTopNavChipProps = {
	label: string;
	active: boolean;
	onClick: () => void;
	className?: string;
};

export function PoemmaTopNavChip({
	label,
	active,
	onClick,
	className,
}: PoemmaTopNavChipProps) {
	return (
		<button
			type="button"
			className={cn(
				active
					? POEMMA_TOP_NAV_CHIP_ACTIVE_CLASS
					: POEMMA_TOP_NAV_CHIP_INACTIVE_CLASS,
				className
			)}
			aria-current={active ? 'page' : undefined}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
