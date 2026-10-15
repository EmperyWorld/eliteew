/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: New World Admin boolean toggle (checkbox role=switch).
 * Invariants: Uses admin-ui tokens only; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { InputHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import { adminUiFocusRing } from '../adminTokens';

export type AdminToggleProps = Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'type'
> & {
	label?: string;
};

export function AdminToggle({
	className,
	label,
	id,
	checked,
	...rest
}: AdminToggleProps) {
	const inputId = id ?? rest.name;
	return (
		<label
			className={cn(
				'inline-flex cursor-pointer items-center gap-2 text-[length:var(--admin-ui-text-sm)]',
				'text-[var(--admin-ui-fg)]',
				className
			)}
			htmlFor={inputId}
		>
			<input
				id={inputId}
				type="checkbox"
				role="switch"
				aria-checked={Boolean(checked)}
				checked={checked}
				className={cn(
					'h-4 w-7 shrink-0 appearance-none rounded-full border border-[var(--admin-ui-border)]',
					'bg-[var(--admin-ui-surface)] checked:bg-[var(--admin-ui-accent)]',
					adminUiFocusRing
				)}
				{...rest}
			/>
			{label ? <span>{label}</span> : null}
		</label>
	);
}
