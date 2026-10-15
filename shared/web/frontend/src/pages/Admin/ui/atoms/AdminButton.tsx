/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: New World Admin primary/secondary/danger/ghost button.
 * Invariants: Variants from adminTokens only; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import {
	type AdminUiButtonVariant,
	adminUiButtonVariant,
} from '../adminTokens';

export type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: AdminUiButtonVariant;
};

export function AdminButton({
	variant = 'secondary',
	className,
	type = 'button',
	...rest
}: AdminButtonProps) {
	return (
		<button
			type={type}
			className={cn(adminUiButtonVariant[variant], className)}
			{...rest}
		/>
	);
}
