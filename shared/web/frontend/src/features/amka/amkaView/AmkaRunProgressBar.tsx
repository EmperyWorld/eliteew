/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Run progress bar and optional ensemble outcome summary line.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewRunDerived.ts
 */

import { useTranslation } from 'react-i18next';

import { shouldShowAmkaEnsembleOutcomeSummary } from '@/features/amka/amkaViewUtils';

type EnsembleOutcomes = {
	planned: number;
	completed: number;
	fallback: number;
	failed: number;
	running: number;
	pending: number;
};

type AmkaRunProgressBarProps = {
	progress: number;
	runStatus: string;
	ensembleOutcomes: EnsembleOutcomes;
};

export function AmkaRunProgressBar({
	progress,
	runStatus,
	ensembleOutcomes,
}: AmkaRunProgressBarProps) {
	const { t } = useTranslation('marketing');

	return (
		<>
			<div className="h-2 rounded-full bg-(--desktop-surface-panel)">
				<div
					className="h-2 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.72)] transition-[width]"
					style={{ width: `${Math.max(4, progress)}%` }}
				/>
			</div>
			{shouldShowAmkaEnsembleOutcomeSummary(ensembleOutcomes, runStatus) ? (
				<p className="text-xs text-(--desktop-text-muted) wrap-pretty">
					{t('amkaView.ensembleRunOutcomeSummary', {
						planned: ensembleOutcomes.planned,
						completed: ensembleOutcomes.completed,
						fallback: ensembleOutcomes.fallback,
						failed: ensembleOutcomes.failed,
						running: ensembleOutcomes.running,
						pending: ensembleOutcomes.pending,
					})}
				</p>
			) : null}
		</>
	);
}
