import * as React from 'react';
import { type ButtonHTMLAttributes } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
	size?: 'sm' | 'md' | 'lg';
	isLoading?: boolean;
	fullWidth?: boolean;
}

const variantClassName: Record<NonNullable<ButtonProps['variant']>, string> = {
	primary:
		'border border-transparent bg-[rgb(var(--desktop-accent-rgb))] text-white hover:opacity-95',
	secondary:
		'border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft)',
	outline:
		'border border-(--desktop-border-strong) bg-transparent text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft)',
	ghost:
		'border border-transparent bg-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)',
	danger:
		'border border-red-400/40 bg-red-500/12 text-red-100 hover:bg-red-500/18',
};

const focusVisibleRing =
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)';

const sizeClassName: Record<NonNullable<ButtonProps['size']>, string> = {
	sm: 'rounded-xl px-3 py-2 text-sm',
	md: 'rounded-2xl px-4 py-2.5 text-sm font-medium',
	lg: 'rounded-2xl px-5 py-3 text-base font-semibold',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			variant = 'primary',
			size = 'md',
			isLoading = false,
			fullWidth = false,
			className,
			disabled,
			children,
			...props
		},
		ref
	) => (
		<button
			ref={ref}
			disabled={disabled || isLoading}
			aria-busy={isLoading || undefined}
			className={cn(
				'inline-flex items-center justify-center gap-2 transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
				focusVisibleRing,
				variantClassName[variant],
				sizeClassName[size],
				fullWidth && 'w-full',
				className
			)}
			{...props}
		>
			{isLoading ? (
				<ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
			) : null}
			{children}
		</button>
	)
);

Button.displayName = 'Button';
