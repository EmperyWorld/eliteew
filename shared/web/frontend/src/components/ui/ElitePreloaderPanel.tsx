/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared branded glass panel for EliteEW preloaders so app, desktop, EWA and UGS loading states look consistent.
 *
 * Invariants:
 * - The progress/quote block is always rendered through `ElitePreloaderProgressQuote`.
 * - Callers may replace the default spinner with a product-specific decorative ornament, but not the panel chrome.
 *
 * Related:
 * - `ElitePreloaderProgressQuote.tsx`
 * - `EliteRecoveryScreen.tsx`
 */
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';
import type { EliteQuote } from './eliteQuotes';
import {
	ElitePreloaderProgressQuote,
	type ElitePreloaderProgressVariant,
} from './ElitePreloaderProgressQuote';

export type ElitePreloaderPanelProps = {
	quote?: EliteQuote;
	ornament?: ReactNode;
	className?: string;
	progressClassName?: string;
	quoteAnimate?: boolean;
	variant?: ElitePreloaderProgressVariant;
};

function DefaultElitePreloaderOrnament({
	variant = 'boot',
}: {
	variant?: ElitePreloaderProgressVariant;
}): React.JSX.Element {
	if (variant === 'recovery') {
		return (
			<div
				className="elite-recovery-ornament mx-auto flex size-14 items-center justify-center"
				aria-hidden
			>
				<span className="elite-recovery-ornament-ring" />
				<span className="elite-recovery-ornament-ring elite-recovery-ornament-ring--delay" />
				<span className="elite-recovery-ornament-core">EW</span>
			</div>
		);
	}

	return (
		<div className="mx-auto flex size-14 items-center justify-center rounded-3xl border border-lime-200/28 bg-lime-300/12">
			{/* Static mark — infinite spin was a GPU tax while Suspense/bootstrap stayed up. */}
			<div className="size-9 rounded-2xl border border-lime-200/28 bg-lime-300/10" />
		</div>
	);
}

export function ElitePreloaderPanel({
	quote,
	ornament,
	className,
	progressClassName,
	quoteAnimate = false,
	variant = 'boot',
}: ElitePreloaderPanelProps): React.JSX.Element {
	return (
		<div
			className={cn(
				'elite-glass-panel elite-glass-panel-premium flex w-full max-w-md flex-col items-center gap-5 px-6 py-7 text-center text-white',
				className
			)}
		>
			{ornament === undefined ? (
				<DefaultElitePreloaderOrnament variant={variant} />
			) : (
				ornament
			)}
			<ElitePreloaderProgressQuote
				quote={quote}
				quoteAnimate={quoteAnimate}
				variant={variant}
				className={progressClassName}
			/>
		</div>
	);
}
