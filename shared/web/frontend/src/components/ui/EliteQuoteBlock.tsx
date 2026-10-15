/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared blockquote for EliteEW preloaders and technical states — always shows quote text and author cite.
 *
 * Invariants:
 * - Historical author cite uses em dash prefix and is mandatory on every variant.
 *
 * Related:
 * - `ElitePreloaderProgressQuote.tsx`
 * - `EliteTechnicalState.tsx`
 */

import { cn } from '@/utils/cn';
import { isLongEliteQuote, type EliteQuote } from './eliteQuotes';

export type EliteQuoteBlockVariant = 'light' | 'dark';

export type EliteQuoteBlockProps = {
	quote: EliteQuote;
	variant?: EliteQuoteBlockVariant;
	className?: string;
	animate?: boolean;
};

export function EliteQuoteBlock({
	quote,
	variant = 'light',
	className,
	animate = false,
}: EliteQuoteBlockProps): React.JSX.Element {
	const isLight = variant === 'light';
	const isLong = isLongEliteQuote(quote.text);

	return (
		<blockquote
			key={animate ? quote.id : undefined}
			className={cn(
				isLight
					? 'elite-quote-card-light mx-auto min-h-[5.5rem] rounded-2xl px-4 py-3'
					: 'elite-quote-card-dark mx-auto min-h-[4.5rem] max-w-md',
				animate && 'elite-quote-crossfade',
				className
			)}
		>
			<p
				className={cn(
					'text-balance font-semibold leading-7',
					isLong ? 'text-lg' : 'text-xl',
					isLight
						? 'font-bold text-slate-950'
						: 'text-lime-50 drop-shadow-[0_1px_14px_rgba(217,249,157,0.18)]'
				)}
				style={{
					fontFamily:
						'var(--elite-quote-font, "Cormorant Garamond", Georgia, serif)',
				}}
			>
				«{quote.text}»
			</p>
			<cite
				className={cn(
					'elite-quote-author mt-2 block text-sm font-medium not-italic',
					isLight ? 'text-slate-500' : 'text-lime-200/82'
				)}
				style={{
					fontFamily:
						'var(--desktop-font-family, "Manrope", "Segoe UI", sans-serif)',
				}}
			>
				{quote.author}
			</cite>
		</blockquote>
	);
}
