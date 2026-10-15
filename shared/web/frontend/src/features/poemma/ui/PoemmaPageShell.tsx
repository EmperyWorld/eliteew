/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Standard POEMMA page layout shell with responsive spacing; content uses full workspace width.
 *
 * Invariants:
 * - Does not alter routing or ACL; purely presentational wrapper.
 *
 * Related:
 * - src/features/poemma/ui/poemmaUiClasses.ts
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { POEMMA_PAGE_SHELL_CLASS } from './poemmaUiClasses';

export type PoemmaPageShellProps = {
	children: ReactNode;
	className?: string;
};

export function PoemmaPageShell({ children, className }: PoemmaPageShellProps) {
	return (
		<div className={cn(POEMMA_PAGE_SHELL_CLASS, className)}>{children}</div>
	);
}
