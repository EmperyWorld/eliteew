/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Section wrapper with optional label, helper text, and trailing action for POEMMA screens.
 *
 * Invariants:
 * - Section spacing follows wave-4 rhythm (`mt-6` first block, `mt-8` subsequent).
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPageHeader.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
	POEMMA_SECTION_ACCENT_RULE_CLASS,
	POEMMA_SECTION_BODY_CLASS,
	POEMMA_SECTION_HELPER_CLASS,
} from './poemmaUiClasses';
import { PoemmaSectionTitle } from './PoemmaSectionTitle';

export type PoemmaPageSectionProps = {
	label?: string;
	helper?: string;
	action?: ReactNode;
	children: ReactNode;
	spacing?: 'default' | 'compact' | 'none';
	/** When `framed`, section body sits in a soft elevated well for clearer grouping. */
	variant?: 'plain' | 'framed';
	className?: string;
};

export function PoemmaPageSection({
	label,
	helper,
	action,
	children,
	spacing = 'default',
	variant = 'plain',
	className,
}: PoemmaPageSectionProps) {
	const hasHeader = Boolean(label || action);

	return (
		<section
			className={cn(
				'grid gap-3.5',
				spacing === 'default' && 'mt-8 first:mt-6',
				spacing === 'compact' && 'mt-6 first:mt-5',
				className
			)}
		>
			{hasHeader ? (
				<div className="grid gap-2.5">
					<div className="flex flex-wrap items-end justify-between gap-3">
						{label ? (
							<div className="min-w-0 flex-1">
								<PoemmaSectionTitle>{label}</PoemmaSectionTitle>
							</div>
						) : null}
						{action ? (
							<div className="flex shrink-0 flex-wrap items-center gap-2">
								{action}
							</div>
						) : null}
					</div>
					{label ? (
						<div className={POEMMA_SECTION_ACCENT_RULE_CLASS} aria-hidden />
					) : null}
				</div>
			) : null}
			{helper ? <p className={POEMMA_SECTION_HELPER_CLASS}>{helper}</p> : null}
			{variant === 'framed' ? (
				<div className={POEMMA_SECTION_BODY_CLASS}>{children}</div>
			) : (
				children
			)}
		</section>
	);
}
