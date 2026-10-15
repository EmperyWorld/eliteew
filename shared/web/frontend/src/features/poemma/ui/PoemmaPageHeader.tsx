/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * POEMMA page hero/header block: eyebrow, title, description, meta slot, and primary actions.
 *
 * Invariants:
 * - Title remains plain text from caller; no automatic uppercase transforms.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPageSection.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PoemmaEyebrowLabel } from './PoemmaEyebrowLabel';
import {
	POEMMA_DISPLAY_TITLE_CLASS,
	POEMMA_DISPLAY_TITLE_HERO_CLASS,
	POEMMA_HERO_PANEL_CLASS,
	POEMMA_META_CHIP_CLASS,
} from './poemmaUiClasses';

export type PoemmaPageHeaderProps = {
	eyebrow?: string;
	title: string;
	description?: string;
	meta?: ReactNode;
	actions?: ReactNode;
	variant?: 'panel' | 'hero' | 'plain';
	className?: string;
};

export function PoemmaPageHeader({
	eyebrow,
	title,
	description,
	meta,
	actions,
	variant = 'plain',
	className,
}: PoemmaPageHeaderProps) {
	const titleClassName =
		variant === 'hero'
			? POEMMA_DISPLAY_TITLE_HERO_CLASS
			: POEMMA_DISPLAY_TITLE_CLASS;

	const content = (
		<div className="flex flex-wrap items-start justify-between gap-4">
			<div className="min-w-0 space-y-2">
				{eyebrow ? <PoemmaEyebrowLabel>{eyebrow}</PoemmaEyebrowLabel> : null}
				<h1 className={titleClassName}>{title}</h1>
				{description ? (
					<p className="text-sm leading-6 text-(--desktop-text-secondary) md:text-base md:leading-7">
						{description}
					</p>
				) : null}
			</div>
			{meta ? <div className={POEMMA_META_CHIP_CLASS}>{meta}</div> : null}
		</div>
	);

	if (variant === 'hero') {
		return (
			<div className={cn(POEMMA_HERO_PANEL_CLASS, className)}>
				{content}
				{actions ? (
					<div className="mt-4 flex flex-wrap gap-2">{actions}</div>
				) : null}
			</div>
		);
	}

	return (
		<div className={cn('grid gap-3', className)}>
			{content}
			{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
		</div>
	);
}
