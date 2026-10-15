/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline validation error line for POEMMA forms.
 *
 * Invariants:
 * - Renders nothing when message is empty/null.
 *
 * Related:
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import { cn } from '@/utils/cn';
import { POEMMA_FIELD_ERROR_CLASS } from './poemmaUiClasses';

export type PoemmaFieldErrorProps = {
	message?: string | null;
	className?: string;
};

export function PoemmaFieldError({
	message,
	className,
}: PoemmaFieldErrorProps) {
	if (!message?.trim()) {
		return null;
	}

	return <p className={cn(POEMMA_FIELD_ERROR_CLASS, className)}>{message}</p>;
}
