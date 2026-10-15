/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: New World Admin text field.
 * Invariants: adminUiFieldClass only; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { InputHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import { adminUiFieldClass } from '../adminTokens';

export type AdminFieldProps = InputHTMLAttributes<HTMLInputElement>;

export function AdminField({ className, ...rest }: AdminFieldProps) {
	return <input className={cn(adminUiFieldClass, className)} {...rest} />;
}
