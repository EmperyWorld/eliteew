/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app surface primitives: panel variants, toolbar, and shell containers.
 *
 * Invariants:
 * - No backdrop-filter / glass blur on shared chrome surfaces.
 *
 * Related:
 * - desktopAppChrome/styleContract.ts
 */

import { cn } from '@/utils/cn';
import { cva, type VariantProps } from '@/utils/cva';
import type { HTMLAttributes } from 'react';
import { DESKTOP_APP_STYLE_CONTRACT, MENU_SURFACE } from './styleContract';

const surfaceVariants = cva('min-h-0', {
	variants: {
		variant: {
			shell: DESKTOP_APP_STYLE_CONTRACT.shell,
			panel: DESKTOP_APP_STYLE_CONTRACT.panel,
			panelStrong: DESKTOP_APP_STYLE_CONTRACT.panelStrong,
			/** Softer recessed bubble (e.g. assistant replies vs user panel). */
			inset: cn(
				'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
				'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.42)]',
				'bg-(--desktop-surface-soft)',
				'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]',
				'ring-1 ring-inset ring-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)]'
			),
			menu: MENU_SURFACE,
			soft: DESKTOP_APP_STYLE_CONTRACT.softCard,
		},
		padding: {
			none: '',
			sm: 'p-2',
			md: 'p-3',
			lg: 'p-4',
		},
	},
	defaultVariants: {
		variant: 'panel',
		padding: 'none',
	},
});

interface DesktopAppSurfaceProps
	extends HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof surfaceVariants> {}

export const DesktopAppSurface: React.FC<DesktopAppSurfaceProps> = ({
	className,
	variant,
	padding,
	style,
	...props
}) => {
	const surfaceShadowClass =
		variant === 'menu' || variant === 'panelStrong'
			? 'shadow-[var(--desktop-shadow-panel)]'
			: variant === 'panel' || variant === 'soft'
				? 'shadow-[var(--desktop-shadow-soft)]'
				: '';
	return (
		<div
			className={cn(
				surfaceVariants({ variant, padding }),
				surfaceShadowClass,
				className
			)}
			style={style}
			{...props}
		/>
	);
};

export const DesktopAppPanel: React.FC<DesktopAppSurfaceProps> = (props) => (
	<DesktopAppSurface variant="panel" {...props} />
);

export const DesktopAppToolbar: React.FC<HTMLAttributes<HTMLDivElement>> = ({
	className,
	...props
}) => (
	<div
		className={cn(DESKTOP_APP_STYLE_CONTRACT.toolbar, className)}
		{...props}
	/>
);
