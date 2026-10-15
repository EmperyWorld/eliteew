/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared primary lime action button for EliteEW recovery and technical error screens.
 *
 * Related:
 * - `EliteRecoveryScreen.tsx`
 * - `EliteTechnicalState.tsx`
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type EliteLimeActionButtonProps = {
	children: ReactNode;
	className?: string;
	busy?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function EliteLimeActionButton({
	children,
	className,
	busy = false,
	disabled,
	type = 'button',
	...props
}: EliteLimeActionButtonProps): React.JSX.Element {
	return (
		<button
			type={type}
			disabled={disabled || busy}
			aria-busy={busy || undefined}
			className={cn(
				'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border',
				'border-lime-200/42 bg-lime-300/16 px-5 py-2.5 text-sm font-medium text-lime-50',
				'elite-lime-action-premium transition hover:bg-lime-300/25 focus-visible:outline-hidden focus-visible:ring-2',
				'focus-visible:ring-lime-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
				busy && 'cursor-wait opacity-90',
				className
			)}
			{...props}
		>
			{busy ? (
				<span
					className="inline-block size-3.5 shrink-0 rounded-full border-2 border-lime-200/25 border-t-lime-50 motion-safe:animate-spin motion-reduce:animate-none"
					aria-hidden
				/>
			) : null}
			{children}
		</button>
	);
}
