import * as React from 'react';
import { type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Input = React.forwardRef<
	HTMLInputElement,
	InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
	<input
		ref={ref}
		className={cn(
			'min-h-11 w-full rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2.5 text-sm text-(--desktop-text-primary) outline-none transition-colors placeholder:text-(--desktop-text-secondary)/75 placeholder:opacity-90 invalid:border-red-400/55 invalid:ring-2 invalid:ring-red-400/20 aria-invalid:border-red-400/55 aria-invalid:ring-2 aria-invalid:ring-red-400/20 focus:border-(--desktop-border-strong) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)',
			className
		)}
		{...props}
	/>
));

Input.displayName = 'Input';
