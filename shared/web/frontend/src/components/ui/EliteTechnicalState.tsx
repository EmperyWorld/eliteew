/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Единый пользовательский каркас для actionable technical screens EliteEW: crash recovery, tab conflict, in-app maintenance.
 *
 * Invariants:
 * - Product authorship footer shows only here (not on ordinary preloaders or recovery waiting).
 * - Quote rotation is off unless `quoteRotationIntervalMs > 0`; pass `quote={null}` to hide cite.
 * - Text must not expose internal container or stack names.
 *
 * Related:
 * - `EliteRecoveryScreen.tsx`
 * - `contexts/MaintenanceContext.tsx`
 * - `components/AppErrorBoundary.tsx`
 */

import { type CSSProperties, type ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';
import { EliteLimeActionButton } from './EliteLimeActionButton';
import { EliteQuoteBlock } from './EliteQuoteBlock';
import { type EliteQuote, useRotatingEliteQuote } from './eliteQuotes';

export type EliteTechnicalStateTone =
	| 'acid'
	| 'cyan'
	| 'amber'
	| 'rose'
	| 'violet';

const TONE_CLASS: Record<
	EliteTechnicalStateTone,
	{
		aura: string;
		border: string;
		text: string;
		button: string;
	}
> = {
	acid: {
		aura: 'from-lime-300/24 via-green-400/14 to-slate-950',
		border: 'border-lime-200/32',
		text: 'text-lime-100',
		button:
			'border-lime-200/42 bg-lime-300/16 text-lime-50 hover:bg-lime-300/25 focus-visible:ring-lime-200/70',
	},
	cyan: {
		aura: 'from-lime-300/24 via-green-400/14 to-slate-950',
		border: 'border-lime-200/32',
		text: 'text-lime-100',
		button:
			'border-lime-200/42 bg-lime-300/16 text-lime-50 hover:bg-lime-300/25 focus-visible:ring-lime-200/70',
	},
	amber: {
		aura: 'from-lime-300/20 via-amber-300/14 to-slate-950',
		border: 'border-amber-200/30',
		text: 'text-amber-100',
		button:
			'border-amber-200/40 bg-amber-300/16 text-amber-50 hover:bg-amber-300/24 focus-visible:ring-amber-200/60',
	},
	rose: {
		aura: 'from-rose-300/20 via-lime-300/10 to-slate-950',
		border: 'border-rose-200/30',
		text: 'text-rose-100',
		button:
			'border-rose-200/40 bg-rose-300/16 text-rose-50 hover:bg-rose-300/24 focus-visible:ring-rose-200/60',
	},
	violet: {
		aura: 'from-lime-300/24 via-green-400/14 to-slate-950',
		border: 'border-lime-200/32',
		text: 'text-lime-100',
		button:
			'border-lime-200/42 bg-lime-300/16 text-lime-50 hover:bg-lime-300/25 focus-visible:ring-lime-200/70',
	},
};

export type EliteTechnicalStateProps = {
	title: ReactNode;
	description?: ReactNode;
	eyebrow?: ReactNode;
	statusLabel?: ReactNode;
	icon?: ReactNode;
	footnote?: ReactNode;
	quote?: EliteQuote | null;
	quoteRotationIntervalMs?: number;
	actionLabel?: ReactNode;
	actionPendingLabel?: ReactNode;
	onAction?: () => void | Promise<void>;
	children?: ReactNode;
	tone?: EliteTechnicalStateTone;
	fullScreen?: boolean;
	className?: string;
	cardClassName?: string;
	style?: CSSProperties;
	role?: 'status' | 'alert';
	ariaLive?: 'off' | 'polite' | 'assertive';
};

export function EliteTechnicalState({
	title,
	description,
	eyebrow = 'EliteEW',
	statusLabel,
	icon,
	footnote,
	quote,
	quoteRotationIntervalMs,
	actionLabel,
	actionPendingLabel = 'Выполняем…',
	onAction,
	children,
	tone = 'acid',
	fullScreen = true,
	className,
	cardClassName,
	style,
	role = 'status',
	ariaLive = 'polite',
}: EliteTechnicalStateProps): React.JSX.Element {
	const [actionBusy, setActionBusy] = useState(false);
	const toneClass = TONE_CLASS[tone];
	const showRotatingQuote =
		quote === undefined &&
		quoteRotationIntervalMs != null &&
		quoteRotationIntervalMs > 0;
	const rotatedQuote = useRotatingEliteQuote({
		intervalMs: showRotatingQuote ? quoteRotationIntervalMs : 0,
		category: 'perseverance',
	});
	const displayQuote =
		quote === undefined ? (showRotatingQuote ? rotatedQuote : null) : quote;

	const handleAction = (): void => {
		if (!onAction || actionBusy) {
			return;
		}
		setActionBusy(true);
		try {
			const result = onAction();
			if (result instanceof Promise) {
				void result.finally(() => setActionBusy(false));
				return;
			}
		} catch {
			/* ignore */
		}
		setActionBusy(false);
	};

	return (
		<section
			className={cn(
				'relative isolate flex min-h-full items-center justify-center overflow-hidden p-5 text-white',
				fullScreen && 'min-h-screen',
				className
			)}
			style={style}
			role={role}
			aria-live={ariaLive}
		>
			<div
				className="elite-shell-aura pointer-events-none absolute inset-0"
				aria-hidden
			/>
			{tone !== 'acid' && tone !== 'cyan' && tone !== 'violet' ? (
				<div
					className={cn(
						'pointer-events-none absolute inset-0 bg-slate-950/40',
						`bg-linear-to-br ${toneClass.aura}`
					)}
					aria-hidden
				/>
			) : null}
			<div
				className={cn(
					'elite-glass-panel relative w-full max-w-xl px-6 py-7 text-center sm:px-9 sm:py-8',
					toneClass.border,
					cardClassName
				)}
			>
				<div className="mx-auto mb-5 flex size-16 items-center justify-center">
					{icon ?? (
						<div className="relative flex size-16 items-center justify-center rounded-3xl border border-lime-200/18 bg-white/8">
							<div
								className={cn(
									'absolute -inset-1 rounded-[1.75rem] border border-transparent border-t-lime-200/80',
									'motion-safe:animate-spin motion-reduce:animate-none'
								)}
								aria-hidden
							/>
							<span className="text-sm font-semibold tracking-[0.24em] text-lime-50/90">
								EW
							</span>
						</div>
					)}
				</div>
				<div
					className={cn(
						'text-[0.72rem] font-semibold tracking-[0.2em]',
						toneClass.text
					)}
				>
					{eyebrow}
				</div>
				<h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
					{title}
				</h1>
				{description ? (
					<div className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-200/86">
						{description}
					</div>
				) : null}
				{statusLabel ? (
					<p className="elite-recovery-status-pill mx-auto mt-5 w-fit">
						{statusLabel}
					</p>
				) : null}
				{displayQuote ? (
					<EliteQuoteBlock
						quote={displayQuote}
						variant="dark"
						animate={showRotatingQuote}
						className="mt-6"
					/>
				) : null}
				{children ? <div className="mt-6">{children}</div> : null}
				{actionLabel && onAction ? (
					<EliteLimeActionButton
						className="mt-6"
						busy={actionBusy}
						onClick={handleAction}
					>
						{actionBusy ? actionPendingLabel : actionLabel}
					</EliteLimeActionButton>
				) : null}
				<p className="mt-7 text-[0.68rem] tracking-[0.12em] text-white/34">
					po&T && TZBrand
				</p>
				{footnote ? (
					<div className="mx-auto mt-3 max-w-sm text-xs leading-5 text-slate-300/58">
						{footnote}
					</div>
				) : null}
			</div>
		</section>
	);
}
