/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * POEMMA hero surface — accent rail, gradient fill, elevated shadow for primary context blocks.
 *
 * Invariants:
 * - Uses POEMMA_HERO_PANEL_CLASS; content layout stays with caller.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPagePanel.tsx
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type { ComponentProps } from 'react';
import { POEMMA_HERO_PANEL_CLASS } from './poemmaUiClasses';

export type PoemmaHeroPanelProps = ComponentProps<typeof DesktopAppPanel>;

export function PoemmaHeroPanel({ className, ...props }: PoemmaHeroPanelProps) {
	return (
		<DesktopAppPanel
			className={cn(POEMMA_HERO_PANEL_CLASS, className)}
			{...props}
		/>
	);
}
