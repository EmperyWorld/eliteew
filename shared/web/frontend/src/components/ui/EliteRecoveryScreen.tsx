/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Recovery/waiting full-screen state: preloader visual with optional status copy and one action button.
 *
 * Invariants:
 * - No product authorship footer (`po&T && TZBrand`); historical quote author always shown.
 * - Recovery mode uses indeterminate progress (not boot 0–99% fill).
 * - Long-lived recovery freezes infinite CSS ambient (`elite-recovery-ambient-static`) so GPU
 *   paint does not loop while the user waits on a failed desktop hydrate.
 * - Quote rotation defaults **off** for recovery (static first quote); callers may opt in.
 *
 * Related:
 * - `contexts/MaintenanceContext.tsx`
 * - `utils/staleBundleReload.ts`
 * - `documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`
 */

import { type CSSProperties, type ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';
import { EliteLimeActionButton } from './EliteLimeActionButton';
import {
	ELITE_RECOVERY_QUOTE_CATEGORIES,
	type EliteQuote,
	type EliteQuoteCategory,
	useRotatingEliteQuote,
} from './eliteQuotes';
import { EliteFullscreenShell } from './EliteFullscreenShell';
import {
	ElitePreloaderPanel,
	type ElitePreloaderPanelProps,
} from './ElitePreloaderPanel';

export type EliteRecoveryScreenProps = {
	title?: ReactNode;
	description?: ReactNode;
	statusLabel?: ReactNode;
	footnote?: ReactNode;
	quote?: EliteQuote | null;
	quoteCategory?: EliteQuoteCategory | readonly EliteQuoteCategory[];
	quoteRotationIntervalMs?: number;
	actionLabel?: ReactNode;
	actionPendingLabel?: ReactNode;
	onAction?: () => unknown;
	panelVariant?: ElitePreloaderPanelProps['variant'];
	/**
	 * When true (default), pause infinite recovery CSS loops after enter.
	 * Opt out only for short-lived overlays that need live “working” motion.
	 */
	ambientStatic?: boolean;
	fullScreen?: boolean;
	className?: string;
	style?: CSSProperties;
	role?: 'status' | 'alert';
	ariaLive?: 'off' | 'polite' | 'assertive';
};

export function EliteRecoveryScreen({
	title,
	description,
	statusLabel,
	footnote,
	quote,
	quoteCategory = ELITE_RECOVERY_QUOTE_CATEGORIES,
	quoteRotationIntervalMs = 0,
	actionLabel,
	actionPendingLabel = 'Проверяем…',
	onAction,
	panelVariant = 'recovery',
	ambientStatic = true,
	fullScreen = true,
	className,
	style,
	role = 'status',
	ariaLive = 'polite',
}: EliteRecoveryScreenProps): React.JSX.Element {
	const [actionBusy, setActionBusy] = useState(false);
	const rotatedQuote = useRotatingEliteQuote({
		category: quote === undefined ? quoteCategory : undefined,
		intervalMs: quote === undefined ? quoteRotationIntervalMs : 0,
	});
	const displayQuote = quote === undefined ? rotatedQuote : quote;
	const quoteAnimates = quote === undefined && quoteRotationIntervalMs > 0;

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
		<EliteFullscreenShell
			fullScreen={fullScreen}
			className={cn(
				'elite-recovery-enter',
				ambientStatic && 'elite-recovery-ambient-static',
				className
			)}
			style={style}
			role={role}
			ariaLive={ariaLive}
		>
			{(title || description) && (
				<div className="sr-only">
					{title ? <h1>{title}</h1> : null}
					{description ? <p>{description}</p> : null}
				</div>
			)}
			{statusLabel ? (
				<p className="elite-recovery-status-pill mx-auto mb-3 w-fit text-center">
					{statusLabel}
				</p>
			) : null}
			{description ? (
				<p className="elite-recovery-subtitle">{description}</p>
			) : null}
			<ElitePreloaderPanel
				quote={displayQuote ?? undefined}
				quoteAnimate={quoteAnimates}
				variant={panelVariant}
			/>
			{actionLabel && onAction ? (
				<div className="mt-5 text-center">
					<EliteLimeActionButton busy={actionBusy} onClick={handleAction}>
						{actionBusy ? actionPendingLabel : actionLabel}
					</EliteLimeActionButton>
				</div>
			) : null}
			{footnote ? <p className="elite-recovery-footnote">{footnote}</p> : null}
		</EliteFullscreenShell>
	);
}
