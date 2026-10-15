/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app chrome controls: buttons, inputs, selects, list rows, section labels.
 *
 * Invariants:
 * - Keyboard-visible focus styles on interactive controls.
 *
 * Related:
 * - desktopAppChrome/styleContract.ts
 */

import { cn } from '@/utils/cn';
import { cva, type VariantProps } from '@/utils/cva';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import {
	forwardRef,
	type ButtonHTMLAttributes,
	type HTMLAttributes,
	type InputHTMLAttributes,
	type SelectHTMLAttributes,
} from 'react';
import * as React from 'react';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '../../context/DesktopShellFrameContext';
import { getDesktopNativeSelectControlClassName } from '../../utils/desktopVisualSystem';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from './styleContract';

export const DesktopAppSectionLabel: React.FC<
	HTMLAttributes<HTMLSpanElement>
> = ({ className, ...props }) => (
	<span
		className={cn(DESKTOP_APP_STYLE_CONTRACT.sectionLabel, className)}
		{...props}
	/>
);

const buttonVariants = cva(
	cn(
		'inline-flex items-center justify-center gap-2 rounded-(--desktop-radius) border text-sm transition-colors duration-200 motion-reduce:transition-none',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none disabled:saturate-[0.65] disabled:grayscale-[0.2]'
	),
	{
		variants: {
			variant: {
				neutral:
					'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover) active:bg-(--desktop-surface-soft-active)',
				accent:
					'border-[rgb(var(--desktop-accent-rgb))]/25 bg-(--desktop-surface-accent) text-(--desktop-text-primary) hover:bg-(--desktop-surface-accent-strong) active:bg-(--desktop-surface-accent)',
				danger:
					'border-[color-mix(in_srgb,rgb(239_68_68)_42%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_14%,var(--desktop-surface-soft))] text-[color-mix(in_srgb,rgb(185_28_28)_72%,var(--desktop-text-primary))] hover:bg-[color-mix(in_srgb,rgb(239_68_68)_22%,var(--desktop-surface-soft-hover))] active:bg-[color-mix(in_srgb,rgb(220_38_38)_26%,var(--desktop-surface-soft-active))] focus-visible:ring-[color-mix(in_srgb,rgb(239_68_68)_50%,transparent)]',
				ghost:
					'border-transparent bg-transparent text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) active:bg-(--desktop-surface-soft-hover)',
			},
			size: {
				sm: cn('px-2.5 py-1', DESKTOP_TYPOGRAPHY.captionInherit),
				md: 'px-3 py-2 text-sm',
				icon: 'h-10 w-10 min-h-10 min-w-10 p-0',
			},
			active: {
				true: 'text-[rgb(var(--desktop-accent-rgb))] border-[rgb(var(--desktop-accent-rgb))]/40 bg-(--desktop-surface-accent)',
				false: '',
			},
		},
		defaultVariants: {
			variant: 'neutral',
			size: 'md',
			active: false,
		},
	}
);

interface DesktopAppButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

export const DesktopAppButton = React.forwardRef<
	HTMLButtonElement,
	DesktopAppButtonProps
>(({ className, variant, size, active, ...props }, ref) => (
	<button
		ref={ref}
		className={cn(buttonVariants({ variant, size, active }), className)}
		{...props}
	/>
));
DesktopAppButton.displayName = 'DesktopAppButton';

export const DesktopAppInput = forwardRef<
	HTMLInputElement,
	InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
	<input
		ref={ref}
		className={cn(
			DESKTOP_APP_STYLE_CONTRACT.searchField,
			DESKTOP_CHROME_FOCUS_VISIBLE,
			'focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)',
			className
		)}
		{...props}
	/>
));
DesktopAppInput.displayName = 'DesktopAppInput';

/** Нативный `<select>` с оболочкой десктопа (пресет окна) и кастомной стрелкой. */
export const DesktopNativeSelect = forwardRef<
	HTMLSelectElement,
	SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
	const shellFrame = useDesktopShellFrame();
	return (
		<div className="relative inline-flex w-full min-w-40 max-w-full align-middle">
			<select
				ref={ref}
				className={cn(
					getDesktopNativeSelectControlClassName(shellFrame),
					className
				)}
				{...props}
			>
				{children}
			</select>
			<ChevronDownIcon
				className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-(--desktop-text-muted)"
				aria-hidden
				strokeWidth={DESKTOP_LUCIDE.stroke}
			/>
		</div>
	);
});
DesktopNativeSelect.displayName = 'DesktopNativeSelect';

export { DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME } from '../../utils/desktopVisualSystem';

interface DesktopAppListRowProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		Pick<VariantProps<typeof buttonVariants>, 'active'> {
	tone?: 'default' | 'subtle';
}

export const DesktopAppListRow = forwardRef<
	HTMLButtonElement,
	DesktopAppListRowProps
>(function DesktopAppListRow(
	{ className, active, tone = 'default', ...props },
	ref
) {
	return (
		<button
			ref={ref}
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.listRow,
				tone === 'default'
					? active
						? 'bg-(--desktop-surface-soft-hover) border-(--desktop-border-subtle)'
						: 'hover:bg-(--desktop-surface-soft)'
					: active
						? 'bg-(--desktop-surface-accent)'
						: 'hover:bg-(--desktop-surface-soft)',
				className
			)}
			{...props}
		/>
	);
});
DesktopAppListRow.displayName = 'DesktopAppListRow';
