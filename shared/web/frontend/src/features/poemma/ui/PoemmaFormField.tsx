/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Label + control slot + optional validation error for POEMMA forms.
 *
 * Invariants:
 * - Control is opaque ReactNode (DesktopAppInput, textarea with POEMMA_TEXTAREA_CLASS).
 * - Label style `field` vs `eyebrow` must not change visible Russian copy.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaFieldError.tsx
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PoemmaEyebrowLabel } from './PoemmaEyebrowLabel';
import { PoemmaFieldError } from './PoemmaFieldError';
import {
	POEMMA_FIELD_LABEL_CLASS,
	POEMMA_FORM_GRID_CLASS,
} from './poemmaUiClasses';

export type PoemmaFormFieldProps = {
	label: string;
	htmlFor?: string;
	children: ReactNode;
	error?: string | null;
	labelStyle?: 'field' | 'eyebrow';
	className?: string;
};

export function PoemmaFormField({
	label,
	htmlFor,
	children,
	error,
	labelStyle = 'field',
	className,
}: PoemmaFormFieldProps) {
	const labelNode =
		labelStyle === 'eyebrow' ? (
			<PoemmaEyebrowLabel>{label}</PoemmaEyebrowLabel>
		) : htmlFor ? (
			<label htmlFor={htmlFor} className={POEMMA_FIELD_LABEL_CLASS}>
				{label}
			</label>
		) : (
			<span className={POEMMA_FIELD_LABEL_CLASS}>{label}</span>
		);

	return (
		<div className={cn(POEMMA_FORM_GRID_CLASS, className)}>
			{labelNode}
			{children}
			<PoemmaFieldError message={error} />
		</div>
	);
}
