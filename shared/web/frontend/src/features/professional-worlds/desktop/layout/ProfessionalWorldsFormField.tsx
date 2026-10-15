/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Label + control wrapper for Professional Worlds forms.
 *
 * Invariants:
 * - Textarea uses the same field chrome as `PROFESSIONAL_WORLDS_FIELD_CLASS`.
 *
 * Related:
 * - utils/professionalWorldsFormUtils.ts
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { PROFESSIONAL_WORLDS_FIELD_CLASS } from '../utils/professionalWorldsFormUtils';

export function ProfessionalWorldsFormField({
	label,
	htmlFor,
	children,
	className,
}: {
	label: ReactNode;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<label
			htmlFor={htmlFor}
			className={cn(
				'grid gap-1 text-xs font-medium text-(--desktop-text-secondary)',
				className
			)}
		>
			{label}
			{children}
		</label>
	);
}

export function ProfessionalWorldsTextarea({
	className,
	...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(PROFESSIONAL_WORLDS_FIELD_CLASS, className)}
			{...props}
		/>
	);
}
