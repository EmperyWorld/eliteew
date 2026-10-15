import * as React from 'react';
import { cn } from '@/utils/cn';

const paddingClassName = {
	none: '',
	sm: 'p-3',
	md: 'p-4',
	lg: 'p-6',
} as const;

export interface CardProps {
	className?: string;
	children: React.ReactNode;
	onClick?: () => void;
	style?: React.CSSProperties;
	/** Default `none` (legacy). Use `sm` | `md` | `lg` for consistent inset. */
	padding?: keyof typeof paddingClassName;
	/**
	 * Subtle hover affordance for static cards (no `onClick`).
	 * Border/background only — avoids scaling or shadow jumps that fight nested controls.
	 */
	hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
	className,
	children,
	onClick,
	style,
	padding = 'none',
	hoverable = false,
}) => {
	const interactiveButton = Boolean(onClick);

	const baseClass = cn(
		'rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) shadow-(--desktop-shadow-soft) transition-[border-color,background-color,box-shadow]',
		paddingClassName[padding],
		interactiveButton &&
			'cursor-pointer hover:border-(--desktop-border-strong)/80',
		!interactiveButton &&
			hoverable &&
			'hover:border-(--desktop-border-strong)/50 hover:bg-(--desktop-surface-soft)/40',
		className
	);

	if (interactiveButton) {
		return (
			<button
				type="button"
				onClick={onClick}
				style={style}
				className={cn(
					baseClass,
					'w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)'
				)}
			>
				{children}
			</button>
		);
	}

	return (
		<div style={style} className={baseClass}>
			{children}
		</div>
	);
};
