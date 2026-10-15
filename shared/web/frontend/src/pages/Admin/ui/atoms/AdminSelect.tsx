/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: New World Admin native select.
 * Invariants: adminUiFieldClass only; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { SelectHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import { adminUiFieldClass } from '../adminTokens';

export type AdminSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function AdminSelect({
	className,
	children,
	...rest
}: AdminSelectProps) {
	return (
		<select className={cn(adminUiFieldClass, className)} {...rest}>
			{children}
		</select>
	);
}
