/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy «Опора» footnote UI (helpers + optional render). Product thread no longer mounts this under bubbles;
 * evidence lives in `DesktopAiEvidenceLedger` only. Keep helpers for golden/SSE contract tests.
 *
 * Invariants:
 * - Renders metadata only; never embeds RAG chunk bodies.
 * - Context detail `<summary>` keeps native `title` (TooltipV2 cannot wrap summary inside `<details>`).
 * - Expanded detail rows never repeat the visible summary line (empty-context duplicate lock).
 *
 * Related:
 * - desktopChatContextSummary.ts (DesktopAiContextFootnote)
 * - DesktopAiEvidenceLedger.tsx
 */

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { DESKTOP_TYPOGRAPHY } from '../../../pages/Desktop/constants';
import { DesktopChromeTooltip } from '../../../pages/Desktop/components/DesktopChromeTooltip';

import type { DesktopAiContextFootnote as DesktopAiContextFootnoteData } from '../desktopChatContextSummary';

type DesktopAiContextFootnoteProps = {
	footnote: DesktopAiContextFootnoteData;
	className?: string;
};

function toggleDetailsOnSpace(e: React.KeyboardEvent<HTMLElement>): void {
	if (e.key === ' ' || e.code === 'Space') {
		e.preventDefault();
		const root = e.currentTarget.closest('details');
		if (root) {
			root.open = !root.open;
		}
	}
}

/**
 * Tooltip body lines for `<details>`, excluding an exact copy of the summary line.
 * (Previously sliced off the first tooltip row blindly — that left the empty-context
 * phrase duplicated in summary + list.)
 */
export function splitContextTooltipDetailLines(
	tooltip: string,
	summaryLine?: string
): string[] {
	const summary = (summaryLine ?? '').trim();
	return tooltip
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && line !== summary);
}

export function DesktopAiContextFootnote({
	footnote,
	className,
}: DesktopAiContextFootnoteProps) {
	const { t } = useTranslation('desktopAiChat');
	const detailLines = splitContextTooltipDetailLines(
		footnote.tooltip,
		footnote.line
	);

	if (detailLines.length === 0) {
		return (
			<DesktopChromeTooltip
				content={footnote.tooltip}
				placement="top"
				offsetExtra={4}
			>
				<p className={className}>{footnote.line}</p>
			</DesktopChromeTooltip>
		);
	}

	return (
		<details
			className={cn(
				'max-w-[min(92%,42rem)] rounded border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.18)_100%,transparent)] px-1.5 py-0.5',
				className
			)}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: native summary — Space toggles details */}
			<summary
				className={cn(
					'cursor-pointer select-none leading-snug text-(--desktop-text-dim) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] rounded min-h-8 py-0.5',
					DESKTOP_TYPOGRAPHY.small
				)}
				title={footnote.tooltip}
				aria-label={t('contextFootnoteExpandAria')}
				onKeyDown={toggleDetailsOnSpace}
			>
				{footnote.line}
			</summary>
			<ul
				className={cn(
					'mt-1 mb-0.5 list-disc space-y-0.5 pl-4 leading-snug text-(--desktop-text-dim)',
					DESKTOP_TYPOGRAPHY.small
				)}
				aria-label={t('contextFootnoteDetailsAria')}
			>
				{detailLines.map((line) => (
					<li key={line}>{line}</li>
				))}
			</ul>
		</details>
	);
}
