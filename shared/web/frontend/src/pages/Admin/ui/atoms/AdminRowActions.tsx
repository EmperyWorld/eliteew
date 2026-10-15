/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Horizontal action cluster for Admin table rows.
 * Invariants: Children are AdminButton or links; no Old World imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type AdminRowActionsProps = {
	children: ReactNode;
	className?: string;
};

export function AdminRowActions({ children, className }: AdminRowActionsProps) {
	return (
		<div
			className={cn('flex flex-wrap items-center justify-end gap-1', className)}
		>
			{children}
		</div>
	);
}
