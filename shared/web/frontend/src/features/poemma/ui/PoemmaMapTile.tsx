/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Home map tile shell: section label, navigational affordance, and content slot.
 *
 * Invariants:
 * - When `onNavigate` is set, entire tile is a button via PoemmaClickablePanel.
 *
 * Related:
 * - src/features/poemma/home/PoemmaHomePage.tsx
 * - src/features/poemma/ui/PoemmaClickablePanel.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PoemmaClickablePanel } from './PoemmaClickablePanel';
import { POEMMA_MAP_TILE_ARROW_CLASS } from './poemmaUiClasses';
import { PoemmaSectionTitle } from './PoemmaSectionTitle';

export type PoemmaMapTileProps = {
	sectionLabel: string;
	children: ReactNode;
	onNavigate?: () => void;
	className?: string;
};

export function PoemmaMapTile({
	sectionLabel,
	children,
	onNavigate,
	className,
}: PoemmaMapTileProps) {
	return (
		<PoemmaClickablePanel onClick={onNavigate} className={className}>
			<div className="flex items-start justify-between gap-3 border-b border-(--desktop-border-subtle)/80 pb-3.5">
				<PoemmaSectionTitle size="compact">{sectionLabel}</PoemmaSectionTitle>
				{onNavigate ? (
					<span
						className={cn(
							POEMMA_MAP_TILE_ARROW_CLASS,
							'mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
							'border border-(--desktop-border-subtle)',
							'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_70%,var(--desktop-surface-panel))]',
							'group-hover:border-[rgb(var(--desktop-accent-rgb)/0.28)]',
							'group-hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-soft))]'
						)}
						aria-hidden
					>
						→
					</span>
				) : null}
			</div>
			<div className={cn(onNavigate ? 'mt-4' : 'mt-5')}>{children}</div>
		</PoemmaClickablePanel>
	);
}
