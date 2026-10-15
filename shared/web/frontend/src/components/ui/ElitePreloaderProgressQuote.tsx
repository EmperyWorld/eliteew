/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Minimal preloader content: brand, progress indicator and quote.
 *
 * Invariants:
 * - Boot variant animates fill to 99% over 3 seconds.
 * - Recovery variant uses indeterminate shimmer (no fake percentages during backend restart).
 *
 * Related:
 * - `styles/index.css`
 * - `EliteQuoteBlock.tsx`
 */

import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { EliteQuoteBlock } from './EliteQuoteBlock';
import {
	ELITE_QUOTE_ROTATION_MS,
	ELITE_RECOVERY_QUOTE_CATEGORIES,
	pickEliteQuote,
	useRotatingEliteQuote,
	type EliteQuote,
} from './eliteQuotes';

export type ElitePreloaderProgressVariant = 'boot' | 'recovery';

export type ElitePreloaderProgressQuoteProps = {
	quote?: EliteQuote;
	quoteAnimate?: boolean;
	className?: string;
	variant?: ElitePreloaderProgressVariant;
};

export function ElitePreloaderProgressQuote({
	quote,
	quoteAnimate = false,
	className,
	variant = 'boot',
}: ElitePreloaderProgressQuoteProps): React.JSX.Element {
	const shouldRotate =
		quote === undefined && (variant === 'recovery' || quoteAnimate);
	const rotatedQuote = useRotatingEliteQuote({
		category: ELITE_RECOVERY_QUOTE_CATEGORIES,
		intervalMs: shouldRotate ? ELITE_QUOTE_ROTATION_MS : 0,
	});
	const bootQuote = useMemo(() => pickEliteQuote(), []);
	const displayQuote = quote ?? (shouldRotate ? rotatedQuote : bootQuote);
	const isRecovery = variant === 'recovery';

	return (
		<div className={cn('mx-auto w-full max-w-sm text-center', className)}>
			<p className="text-[0.86rem] font-semibold tracking-[0.12em] text-lime-100">
				EliteEW
			</p>
			<div
				className="mt-4"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={isRecovery ? undefined : 99}
				aria-label={isRecovery ? 'Восстановление связи с сервером' : undefined}
			>
				{isRecovery ? (
					<>
						<p className="elite-recovery-progress-label">
							Связь восстанавливается
						</p>
						<div className="elite-recovery-progress-track">
							<div className="elite-recovery-progress-shimmer" aria-hidden />
						</div>
					</>
				) : (
					<>
						<div className="mb-1.5 flex items-center justify-between text-[0.62rem] font-medium text-lime-100/70">
							<span>0%</span>
							<span>100%</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full border border-lime-200/24 bg-slate-950/70 shadow-inner shadow-black/35">
							<div className="elite-preloader-progress-fill h-full rounded-full bg-linear-to-r from-lime-200 via-lime-300 to-[#9dff00]" />
						</div>
					</>
				)}
			</div>
			<EliteQuoteBlock
				quote={displayQuote}
				variant="light"
				animate={quoteAnimate}
				className="mt-5"
			/>
		</div>
	);
}
