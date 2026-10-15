/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stream error banner and collapsible smart-tools history above the composer.
 *
 * Invariants:
 * - Tools history rounds are newest-first in summary label (n = total - index).
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts, DesktopAiChatApp.tsx
 */
import type { TFunction } from 'i18next';
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { DesktopAiWebSearchSources } from './DesktopAiWebSearchSources';
import type { DesktopAiWebSearchSource } from '../desktopWebSearchSources';
import { ArrowPathIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type DesktopAiChatStreamStatusProps = {
	streamErrorBanner: {
		message: string;
		retryable: boolean;
		canClearStreamLock?: boolean;
	} | null;
	streamLockClearBusy: boolean;
	onClearStreamLock: () => void;
	onRetryLastStream: () => void;
	toolsHistory: Array<{
		at: number;
		summary: string;
		sources: DesktopAiWebSearchSource[];
	}>;
	i18nLanguage: string;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatStreamStatus({
	streamErrorBanner,
	streamLockClearBusy,
	onClearStreamLock,
	onRetryLastStream,
	toolsHistory,
	i18nLanguage,
	lucideStroke,
	t,
}: DesktopAiChatStreamStatusProps) {
	return (
		<>
			{streamErrorBanner ? (
				<div
					role="alert"
					className={cn(
						'flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-2 py-1.5 text-amber-100/95',
						DESKTOP_TYPOGRAPHY.captionInherit
					)}
				>
					<span className="min-w-0 flex-1">{streamErrorBanner.message}</span>
					{streamErrorBanner.canClearStreamLock ? (
						<button
							type="button"
							onClick={onClearStreamLock}
							disabled={streamLockClearBusy}
							className={cn(
								'shrink-0 inline-flex min-h-9 items-center gap-1 rounded-lg border border-amber-400/45 bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.38)_100%,transparent)] px-2 py-1 text-amber-50 disabled:opacity-50',
								DESKTOP_TYPOGRAPHY.captionInherit,
								DESKTOP_INTERACTIVE.btnRounded
							)}
						>
							{streamLockClearBusy ? (
								<ArrowPathIcon
									className="h-3 w-3 animate-spin"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							) : (
								<LockOpenIcon
									className="h-3 w-3"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							)}
							{t('clearStreamLock')}
						</button>
					) : null}
					{streamErrorBanner.retryable ? (
						<button
							type="button"
							onClick={onRetryLastStream}
							className={cn(
								'shrink-0 inline-flex min-h-9 items-center gap-1 rounded-lg border border-amber-400/45 bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.38)_100%,transparent)] px-2 py-1 text-amber-50',
								DESKTOP_TYPOGRAPHY.captionInherit,
								DESKTOP_INTERACTIVE.btnRounded
							)}
						>
							<ArrowPathIcon
								className="h-3 w-3"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
							{t('retryStream')}
						</button>
					) : null}
				</div>
			) : null}
			{toolsHistory.length > 0 ? (
				<details className="rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] px-2 py-1 text-sm text-(--desktop-text-secondary) antialiased">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: нативный summary — доп. обработка Space для details */}
					<summary
						className="cursor-pointer select-none text-(--desktop-text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] rounded min-h-9 py-1"
						aria-describedby="desktop-ai-tools-history-kbd"
						onKeyDown={(e) => {
							if (e.key === ' ' || e.code === 'Space') {
								e.preventDefault();
								const root = e.currentTarget.closest('details');
								if (root) {
									root.open = !root.open;
								}
							}
						}}
					>
						{t('toolsHistoryPlainSummary', { count: toolsHistory.length })}
					</summary>
					<p
						id="desktop-ai-tools-history-kbd"
						className={cn(
							'mt-0.5 px-0.5 text-(--desktop-text-dim)',
							DESKTOP_TYPOGRAPHY.micro,
							'font-normal'
						)}
					>
						{t('toolsHistoryKeyboardHint')}
					</p>
					<div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
						{toolsHistory.map((row, roundIdx) => (
							<details
								key={`tool-hist-${row.at}-${row.summary.length}`}
								className="rounded border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] px-1.5 py-1"
							>
								{/* biome-ignore lint/a11y/noStaticElementInteractions: нативный summary — Space переключает details */}
								<summary
									className={cn(
										'cursor-pointer select-none text-(--desktop-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] rounded min-h-8 py-0.5',
										DESKTOP_TYPOGRAPHY.captionInherit
									)}
									onKeyDown={(e) => {
										if (e.key === ' ' || e.code === 'Space') {
											e.preventDefault();
											const root = e.currentTarget.closest('details');
											if (root) {
												root.open = !root.open;
											}
										}
									}}
								>
									{t('toolsHistoryRound', {
										n: toolsHistory.length - roundIdx,
										time: format(new Date(row.at), 'HH:mm:ss', {
											locale: i18nLanguage.startsWith('ru') ? ru : enUS,
										}),
									})}
								</summary>
								<pre
									className={cn(
										'mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap wrap-break-word font-mono leading-snug text-(--desktop-text-secondary)',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{row.summary}
								</pre>
								{row.sources.length > 0 ? (
									<DesktopAiWebSearchSources
										sources={row.sources}
										className="mt-1 border-0 bg-transparent px-0"
										compact
									/>
								) : null}
							</details>
						))}
					</div>
				</details>
			) : null}
		</>
	);
}
