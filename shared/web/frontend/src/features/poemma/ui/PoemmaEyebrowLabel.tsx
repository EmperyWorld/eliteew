/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified uppercase micro-label for POEMMA sections, metrics, and toolbar meta rows.
 *
 * Invariants:
 * - Copy is caller-defined Russian text; component only applies typography tokens.
 *
 * Related:
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
	POEMMA_EYEBROW_LABEL_CLASS,
	POEMMA_EYEBROW_MUTED_CLASS,
} from './poemmaUiClasses';

export type PoemmaEyebrowLabelProps = {
	children: ReactNode;
	tone?: 'default' | 'muted';
	className?: string;
};

export function PoemmaEyebrowLabel({
	children,
	tone = 'default',
	className,
}: PoemmaEyebrowLabelProps) {
	return (
		<span
			className={cn(
				tone === 'muted'
					? POEMMA_EYEBROW_MUTED_CLASS
					: POEMMA_EYEBROW_LABEL_CLASS,
				className
			)}
		>
			{children}
		</span>
	);
}
