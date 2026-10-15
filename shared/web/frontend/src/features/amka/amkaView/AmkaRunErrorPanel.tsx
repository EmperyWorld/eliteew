/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Run-level error panel with optional ensemble resume hint.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewRunDerived.ts
 */

import { useTranslation } from 'react-i18next';

import type { AmkaStepEnsembleMeta } from '@/features/amka/amkaViewUtils';

type RunErrorSummary = {
	message?: string | null;
	stage?: string | null;
} | null;

type AmkaRunErrorPanelProps = {
	runError: RunErrorSummary;
	runErrorMessage: string | null;
	failedEnsembleStep: {
		ordinal: number;
		title: string;
		meta: AmkaStepEnsembleMeta;
	} | null;
	canResume: boolean;
};

export function AmkaRunErrorPanel({
	runError,
	runErrorMessage,
	failedEnsembleStep,
	canResume,
}: AmkaRunErrorPanelProps) {
	const { t } = useTranslation('marketing');

	if (!runError) {
		return null;
	}

	return (
		<div className="rounded-(--desktop-radius) border border-red-500/30 bg-red-500/10 p-3">
			<div className="text-sm font-semibold text-red-100">
				{t('amkaView.runErrorTitle')}
			</div>
			{runError.stage ? (
				<div className="mt-1 text-xs text-red-200/80">
					{t('amkaView.errorStageLabel', {
						value: runError.stage,
					})}
				</div>
			) : null}
			<div className="mt-2 text-sm text-red-100/90">
				{runErrorMessage || t('amkaView.errorDetailsFallback')}
			</div>
			{failedEnsembleStep && canResume ? (
				<p className="mt-2 text-xs leading-relaxed text-red-100/80 wrap-pretty">
					{t('amkaView.ensembleFailedResumeHint', {
						ordinal: failedEnsembleStep.ordinal,
						title: failedEnsembleStep.title,
					})}
				</p>
			) : null}
		</div>
	);
}
