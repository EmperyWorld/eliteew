/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Standard POEMMA content panel — DesktopAppPanel with premium surface tokens.
 *
 * Invariants:
 * - Uses POEMMA_PAGE_PANEL_CLASS; does not alter Desktop panel variant semantics.
 *
 * Related:
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type { ComponentProps } from 'react';
import { POEMMA_PAGE_PANEL_CLASS } from './poemmaUiClasses';

export type PoemmaPagePanelProps = ComponentProps<typeof DesktopAppPanel>;

export function PoemmaPagePanel({ className, ...props }: PoemmaPagePanelProps) {
	return (
		<DesktopAppPanel
			className={cn(POEMMA_PAGE_PANEL_CLASS, className)}
			{...props}
		/>
	);
}
