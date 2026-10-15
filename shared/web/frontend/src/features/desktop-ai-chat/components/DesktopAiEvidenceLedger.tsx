/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact evidence + trust strip under Desktop AI documents (progressive disclosure for material list).
 *
 * Invariants:
 * - Derived AI artifacts are visibly marked as non-independent evidence.
 * - Empty and degraded quality states remain explicit instead of implying verified facts.
 * - Default view stays short; full material rows open only on user expand.
 *
 * Related:
 * - src/features/desktop-ai-chat/desktopAiEvidence.ts
 * - api/services/desktop_chat/context_evidence.py
 */
import {
	ChatBubbleLeftEllipsisIcon,
	CheckBadgeIcon,
	ChevronDownIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon,
	GlobeAltIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type {
	DesktopAiArtifactQualityStatus,
	DesktopAiContextSource,
	DesktopAiContextSourceKind,
} from '../api/desktopChatClient';
import { resolveDesktopAiArtifactQuality } from '../desktopAiEvidence';

const SOURCE_ICON: Record<
	DesktopAiContextSourceKind,
	React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
	chat_attachment: ChatBubbleLeftEllipsisIcon,
	project_document: DocumentTextIcon,
	derived_ai_artifact: SparklesIcon,
	web: GlobeAltIcon,
};

function trustToneClass(tone: 'good' | 'warn' | 'neutral'): string {
	if (tone === 'good') {
		return 'border-emerald-400/30 bg-emerald-400/8 text-emerald-50';
	}
	if (tone === 'warn') {
		return 'border-amber-300/35 bg-amber-300/9 text-amber-50';
	}
	return 'border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,transparent)] text-(--desktop-text-secondary)';
}

export function DesktopAiEvidenceLedger({
	sources,
	qualityStatus,
	className,
}: {
	sources: DesktopAiContextSource[];
	qualityStatus?: DesktopAiArtifactQualityStatus | null;
	className?: string;
}) {
	const { t } = useTranslation('desktopAiChat');
	const quality = resolveDesktopAiArtifactQuality(qualityStatus);
	const independentSources = sources.filter(
		(source) => source.kind !== 'derived_ai_artifact'
	).length;
	const derivedSources = sources.length - independentSources;
	const effectiveGrounding =
		quality.grounding !== 'unknown'
			? quality.grounding
			: independentSources > 0
				? 'light_context'
				: derivedSources > 0
					? 'derived_context'
					: 'hypothesis_only';
	const finalizationTone =
		quality.finalization === 'verified' || quality.finalization === 'repaired'
			? 'good'
			: quality.finalization === 'needs_review'
				? 'warn'
				: 'neutral';
	const groundingTone =
		effectiveGrounding === 'grounded'
			? 'good'
			: effectiveGrounding === 'hypothesis_only' ||
					effectiveGrounding === 'derived_context'
				? 'warn'
				: 'neutral';
	const FinalizationIcon =
		finalizationTone === 'warn' ? ExclamationTriangleIcon : CheckBadgeIcon;
	const GroundingIcon =
		groundingTone === 'warn' ? ExclamationTriangleIcon : DocumentTextIcon;
	const finalizationTitle = t(
		`qualityFinalization.${quality.finalization}.title`
	);
	const finalizationDescription = t(
		`qualityFinalization.${quality.finalization}.description`
	);
	const groundingTitle = t(`qualityGrounding.${effectiveGrounding}.title`);
	const groundingDescription = t(
		`qualityGrounding.${effectiveGrounding}.description`
	);

	return (
		<section
			data-testid="desktop-ai-evidence-ledger"
			aria-label={t('evidenceLedgerAria')}
			className={cn('space-y-1.5', className)}
		>
			<header className="flex flex-wrap items-center gap-1.5">
				<h4
					className={cn(
						'shrink-0 font-semibold text-(--desktop-text-primary)',
						DESKTOP_TYPOGRAPHY.captionInherit
					)}
				>
					{t('evidenceLedgerTitle')}
				</h4>
				<span
					className={cn(
						'rounded border border-(--desktop-border-subtle) px-1 py-px tabular-nums text-(--desktop-text-secondary)',
						DESKTOP_TYPOGRAPHY.small
					)}
				>
					{t('evidenceLedgerCount', { count: sources.length })}
				</span>
				<div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
					<span
						className={cn(
							'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5',
							trustToneClass(finalizationTone)
						)}
						title={finalizationDescription}
					>
						<FinalizationIcon className="size-3 shrink-0" aria-hidden />
						<span
							className={cn(
								'truncate font-semibold leading-none',
								DESKTOP_TYPOGRAPHY.small
							)}
						>
							{finalizationTitle}
						</span>
					</span>
					<span
						className={cn(
							'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5',
							trustToneClass(groundingTone)
						)}
						title={groundingDescription}
					>
						<GroundingIcon className="size-3 shrink-0" aria-hidden />
						<span
							className={cn(
								'truncate font-semibold leading-none',
								DESKTOP_TYPOGRAPHY.small
							)}
						>
							{groundingTitle}
						</span>
					</span>
				</div>
			</header>

			{sources.length > 0 ? (
				<details className="group rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_36%,transparent)] open:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_46%,transparent)]">
					<summary
						className={cn(
							'flex cursor-pointer list-none items-center gap-1.5 px-2 py-1 text-(--desktop-text-secondary) marker:content-none [&::-webkit-details-marker]:hidden',
							DESKTOP_TYPOGRAPHY.small,
							DESKTOP_INTERACTIVE.focusRing
						)}
					>
						<ChevronDownIcon
							className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
							aria-hidden
						/>
						<span className="min-w-0 flex-1 truncate font-medium">
							{t('evidenceLedgerMaterialsSummary', { count: sources.length })}
						</span>
					</summary>
					<ul className="grid max-h-44 gap-1 overflow-y-auto border-t border-(--desktop-border-subtle) px-1.5 py-1.5">
						{sources.map((source) => {
							const SourceIcon = SOURCE_ICON[source.kind];
							const titleText = source.title;
							return (
								<li
									key={`${source.citation_id}:${source.url ?? source.title}`}
									className="flex items-center gap-1.5 rounded border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_28%,transparent)] px-1.5 py-1"
								>
									<span className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-[rgb(var(--desktop-accent-rgb)/0.24)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] text-[rgb(var(--desktop-accent-rgb))]">
										<SourceIcon className="size-3" aria-hidden />
									</span>
									<span
										className={cn(
											'shrink-0 rounded border border-(--desktop-border-subtle) px-1 py-px font-semibold text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.small
										)}
									>
										【{source.citation_id}】
									</span>
									<div className="min-w-0 flex-1">
										{source.url ? (
											<a
												href={source.url}
												target="_blank"
												rel="noreferrer noopener"
												className={cn(
													'block truncate underline decoration-white/25 underline-offset-2 hover:decoration-current',
													DESKTOP_TYPOGRAPHY.small,
													DESKTOP_INTERACTIVE.focusRing
												)}
												title={`${titleText} · ${t(`evidenceAuthority.${source.authority}`)}`}
											>
												{titleText}
											</a>
										) : (
											<p
												className={cn(
													'truncate text-(--desktop-text-primary)',
													DESKTOP_TYPOGRAPHY.small
												)}
												title={`${titleText} · ${t(`evidenceAuthority.${source.authority}`)}`}
											>
												{titleText}
											</p>
										)}
									</div>
									<span
										className={cn(
											'hidden shrink-0 text-(--desktop-text-muted) sm:inline',
											DESKTOP_TYPOGRAPHY.small
										)}
									>
										{t(`evidenceKind.${source.kind}`)}
									</span>
								</li>
							);
						})}
					</ul>
				</details>
			) : (
				<div
					role="note"
					className="rounded-md border border-amber-300/30 bg-amber-300/8 px-2 py-1 text-amber-50"
					title={t('evidenceLedgerEmptyDescription')}
				>
					<p className={cn('font-semibold', DESKTOP_TYPOGRAPHY.small)}>
						{t('evidenceLedgerEmptyTitle')}
					</p>
				</div>
			)}
		</section>
	);
}
