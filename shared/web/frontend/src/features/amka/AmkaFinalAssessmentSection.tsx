/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible final assessment region: metric tiles, reconcile diagnostics, and optional markdown summary.
 *
 * Invariants:
 * - Renders nothing when there are no metrics, reconcile details, or summary markdown.
 * - Markdown rendering uses the same component as the parent Marketing Cabinet context.
 *
 * Related:
 * - src/features/amka/amkaFinalAssessmentModel.ts
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 */
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';

import { ImcResearchResultMarkdown } from '@/services/amka/marketingCabinetAmkaBridge';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

import {
	buildAmkaFinalAssessmentItems,
	buildAmkaReconcileDetailItems,
} from './amkaFinalAssessmentModel';

export type AmkaFinalAssessmentSectionProps = {
	finalAssessment: Record<string, unknown> | null | undefined;
	finalSummaryMarkdown: string | null | undefined;
	t: TFunction<'marketing'>;
};

export function AmkaFinalAssessmentSection({
	finalAssessment,
	finalSummaryMarkdown,
	t,
}: AmkaFinalAssessmentSectionProps) {
	const finalAssessmentItems = useMemo(
		() => buildAmkaFinalAssessmentItems(finalAssessment, t),
		[finalAssessment, t]
	);
	const reconcileItems = useMemo(
		() => buildAmkaReconcileDetailItems(finalAssessment),
		[finalAssessment]
	);

	const summary = (finalSummaryMarkdown ?? '').trim();

	if (
		finalAssessmentItems.length === 0 &&
		reconcileItems.length === 0 &&
		!summary
	) {
		return null;
	}

	return (
		<details className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-3">
			<summary
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'cursor-pointer list-none font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden'
				)}
				aria-label={t('amkaView.spoilerFinalAria')}
			>
				{t('amkaView.spoilerFinalSummary')}
			</summary>
			<div className="mt-3 space-y-4 border-t border-(--desktop-border-subtle) pt-3">
				{finalAssessmentItems.length > 0 ? (
					<div>
						<h4 className="sr-only">{t('amkaView.finalAssessmentTitle')}</h4>
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							{finalAssessmentItems.map((item) => (
								<div
									key={item.label}
									className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2"
								>
									<div className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
										{item.label}
									</div>
									<div className="mt-1 text-lg font-semibold text-(--desktop-text-primary)">
										{item.value}
									</div>
								</div>
							))}
						</div>
					</div>
				) : null}
				{reconcileItems.length > 0 ? (
					<div>
						<h4 className="mb-2 text-sm font-semibold text-(--desktop-text-primary)">
							{t('amkaView.finalReconcileTitle')}
						</h4>
						<ul className="space-y-1.5 text-xs text-(--desktop-text-secondary)">
							{reconcileItems.map((item) => (
								<li
									key={item.key}
									className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-2.5 py-2"
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium text-(--desktop-text-primary)">
											{item.label}
										</span>
										<span className="rounded-full border border-(--desktop-border-subtle) px-2 py-0.5 text-[10px]">
											{item.status}
										</span>
									</div>
									<div className="mt-1">
										{t('amkaView.finalReconcileConfidence', {
											value: item.confidence,
										})}
										{' · '}
										{item.reason}
									</div>
								</li>
							))}
						</ul>
					</div>
				) : null}
				{summary ? (
					<div>
						<h4 className="mb-3 text-sm font-semibold text-(--desktop-text-primary)">
							{t('amkaView.finalSummaryTitle')}
						</h4>
						<ImcResearchResultMarkdown markdown={summary} />
					</div>
				) : null}
			</div>
		</details>
	);
}
