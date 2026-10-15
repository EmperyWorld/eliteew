/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only diagnostic scores and lazy-loaded Recharts for marketing/customer flows.
 *
 * Invariants:
 * - Recharts loads via dynamic import so ClientInteractionView does not inline victory-vendor.
 *
 * Related:
 * - CustomerDiagnosticCharts.tsx, CustomerDiagnosticLeadReport.tsx
 */
import { lazy, Suspense } from 'react';

import { DesktopAppSectionLabel } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import type { DiagnosticComputedResults } from './diagnosticScoring';

const DiagnosticResultsCharts = lazy(async () => {
	const m = await import('./CustomerDiagnosticCharts');
	return { default: m.DiagnosticResultsCharts };
});

export type DiagnosticResultsSectionProps = {
	results: DiagnosticComputedResults;
	t: (k: string, opts?: Record<string, unknown>) => string;
	/** Когда false — только блоки с цифрами и графики, без заголовка секции */
	showHeader?: boolean;
	className?: string;
};

export function DiagnosticResultsSection({
	results,
	t,
	showHeader = true,
	className,
}: DiagnosticResultsSectionProps) {
	return (
		<div className={cn(className)}>
			{showHeader ? (
				<>
					<DesktopAppSectionLabel>
						{t('diagnostic.resultsTitle')}
					</DesktopAppSectionLabel>
					<p className="mt-1 text-xs text-(--desktop-text-secondary)">
						{t('diagnostic.resultsHint')}
					</p>
				</>
			) : null}

			<div className="mt-4 space-y-3 text-sm">
				{results.archetype ? (
					<div className="rounded-xl bg-white/5 p-3">
						<p className="font-medium text-(--desktop-text-primary)">
							{t('diagnostic.resultArchetype', {
								name: results.archetype.dominant.name,
								pct: results.archetype.dominant.percentage,
							})}
						</p>
						<p className="text-(--desktop-text-secondary)">
							{t('diagnostic.resultArchetypeSecondary', {
								name: results.archetype.secondary.name,
								pct: results.archetype.secondary.percentage,
							})}
						</p>
					</div>
				) : null}
				{results.business ? (
					<p className="rounded-xl bg-white/5 p-3 font-medium text-(--desktop-text-primary)">
						{t('diagnostic.resultBusiness', {
							idx: results.business.totalHealthIndex,
						})}
					</p>
				) : null}
				{results.service ? (
					<p className="rounded-xl bg-white/5 p-3 font-medium text-(--desktop-text-primary)">
						{t('diagnostic.resultService', {
							idx: results.service.serviceQualityIndex,
						})}
					</p>
				) : null}
				{results.emotions ? (
					<div className="rounded-xl bg-white/5 p-3">
						<p className="font-medium text-(--desktop-text-primary)">
							{t('diagnostic.resultEmotions', {
								idx: results.emotions.overallEmotionalIndex,
							})}
						</p>
						<ul className="mt-2 flex flex-col gap-1.5 text-xs text-(--desktop-text-secondary)">
							{results.emotions.touchpointResults.map((tp) => (
								<li
									key={tp.id}
									className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5 last:border-0"
								>
									<span>
										{tp.icon} {tp.name}
									</span>
									<span
										className="shrink-0 font-medium"
										style={{ color: tp.status.color }}
									>
										{tp.status.label}
									</span>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</div>

			<div className="mt-6 border-t border-white/10 pt-4">
				<Suspense
					fallback={
						<div
							className="h-48 w-full rounded-(--desktop-radius) bg-(--desktop-surface-soft)/30"
							aria-hidden
						/>
					}
				>
					<DiagnosticResultsCharts results={results} t={t} />
				</Suspense>
			</div>
		</div>
	);
}
