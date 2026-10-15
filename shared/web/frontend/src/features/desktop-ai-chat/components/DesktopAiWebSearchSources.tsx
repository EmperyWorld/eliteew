/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render per-message web-search source links for Desktop AI Chat assistant replies.
 *
 * Invariants:
 * - Unsafe or credential-bearing URLs are normalized out before rendering.
 * - External links open in a new tab with rel=noreferrer.
 *
 * Related:
 * - desktopWebSearchSources.ts
 * - DesktopAiChatApp.tsx
 */

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { DESKTOP_TYPOGRAPHY } from '../../../pages/Desktop/constants';

import {
	normalizeWebSearchSources,
	type DesktopAiWebSearchSource,
} from '../desktopWebSearchSources';

type DesktopAiWebSearchSourcesProps = {
	sources: DesktopAiWebSearchSource[];
	className?: string;
	compact?: boolean;
};

export function DesktopAiWebSearchSources({
	sources,
	className,
	compact = false,
}: DesktopAiWebSearchSourcesProps) {
	const { t } = useTranslation('desktopAiChat');
	const safeSources = normalizeWebSearchSources(sources);
	if (!safeSources.length) {
		return null;
	}
	return (
		<details
			className={cn(
				'rounded border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.18)_100%,transparent)] px-1.5 py-0.5',
				className
			)}
			open={!compact}
		>
			<summary
				className={cn(
					'cursor-pointer select-none leading-snug text-(--desktop-text-dim) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] rounded min-h-8 py-0.5',
					DESKTOP_TYPOGRAPHY.small
				)}
			>
				{t('webSearchSourcesSummary', { count: safeSources.length })}
			</summary>
			<ul
				className={cn(
					'mt-1 mb-0.5 list-none space-y-1 pl-0 leading-snug text-(--desktop-text-dim)',
					DESKTOP_TYPOGRAPHY.small
				)}
			>
				{safeSources.map((source) => (
					<li key={source.url} className="min-w-0">
						<a
							href={source.url}
							target="_blank"
							rel="noreferrer"
							className="break-all text-[rgb(var(--desktop-accent-rgb)/0.92)] underline-offset-2 hover:underline"
						>
							{source.title?.trim() || source.url}
						</a>
						{source.snippet && !compact ? (
							<p className="mt-0.5 text-(--desktop-text-muted)">
								{source.snippet}
							</p>
						) : null}
					</li>
				))}
			</ul>
		</details>
	);
}
