/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Theme-safe inline semantic text (success/warning/danger/info) for POEMMA status lines.
 *
 * Invariants:
 * - Colors use color-mix with desktop CSS variables only (no raw Tailwind palette).
 *
 * Related:
 * - src/features/poemma/ui/PoemmaMetricBadge.tsx
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
	POEMMA_SEMANTIC_DANGER_CLASS,
	POEMMA_SEMANTIC_INFO_CLASS,
	POEMMA_SEMANTIC_SUCCESS_CLASS,
	POEMMA_SEMANTIC_WARNING_CLASS,
} from './poemmaUiClasses';

export type PoemmaSemanticTone = 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<PoemmaSemanticTone, string> = {
	success: POEMMA_SEMANTIC_SUCCESS_CLASS,
	warning: POEMMA_SEMANTIC_WARNING_CLASS,
	danger: POEMMA_SEMANTIC_DANGER_CLASS,
	info: POEMMA_SEMANTIC_INFO_CLASS,
};

export type PoemmaSemanticTextProps = {
	children: ReactNode;
	tone: PoemmaSemanticTone;
	className?: string;
	as?: 'p' | 'span';
};

export function PoemmaSemanticText({
	children,
	tone,
	className,
	as: Tag = 'span',
}: PoemmaSemanticTextProps) {
	return (
		<Tag className={cn('font-semibold', TONE_CLASS[tone], className)}>
			{children}
		</Tag>
	);
}
