/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Readable section heading for POEMMA blocks (sentence case, accent marker) — replaces dry uppercase labels in content.
 *
 * Invariants:
 * - Renders a semantic heading (`h2` by default); copy is caller-defined Russian text.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPageSection.tsx
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
	POEMMA_SECTION_TITLE_CLASS,
	POEMMA_SECTION_TITLE_COMPACT_CLASS,
	POEMMA_SECTION_TITLE_MARKER_CLASS,
} from './poemmaUiClasses';

export type PoemmaSectionTitleProps = {
	children: ReactNode;
	size?: 'default' | 'compact';
	as?: 'h2' | 'h3' | 'p';
	className?: string;
};

export function PoemmaSectionTitle({
	children,
	size = 'default',
	as: Tag = 'h2',
	className,
	...props
}: PoemmaSectionTitleProps & Omit<HTMLAttributes<HTMLElement>, 'children'>) {
	return (
		<div className="flex min-w-0 items-stretch gap-3">
			<span className={POEMMA_SECTION_TITLE_MARKER_CLASS} aria-hidden />
			<Tag
				className={cn(
					size === 'compact'
						? POEMMA_SECTION_TITLE_COMPACT_CLASS
						: POEMMA_SECTION_TITLE_CLASS,
					className
				)}
				{...props}
			>
				{children}
			</Tag>
		</div>
	);
}
