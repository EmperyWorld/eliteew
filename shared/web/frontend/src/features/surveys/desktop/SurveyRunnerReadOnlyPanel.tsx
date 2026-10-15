/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only completed survey answers in premium review-card layout.
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { formatSurveyAnswerDisplay } from './surveyAnswerFormat';
import {
	SH_RUNNER_REVIEW_CARD_CLASS,
	SH_RUNNER_STEP_BADGE_CLASS,
} from './surveyHubLayoutTokens';

type Props = {
	surveyTitle: string;
	questions: SurveyQuestion[];
	answers: Record<string, unknown>;
	onBack: () => void;
};

export function SurveyRunnerReadOnlyPanel({
	surveyTitle,
	questions,
	answers,
	onBack,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<DesktopAppPanel className="mx-4 mb-4 flex flex-col gap-4 p-6">
			<header className="space-y-1">
				<span className={SH_RUNNER_STEP_BADGE_CLASS}>
					{t('history.readOnlyHint')}
				</span>
				<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>{surveyTitle}</h2>
			</header>
			<div className="space-y-3">
				{questions.map((q, index) => (
					<article key={q.question_key} className={SH_RUNNER_REVIEW_CARD_CLASS}>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'flex items-center gap-2 text-(--desktop-text-muted)'
							)}
						>
							<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--desktop-surface-panel) text-[10px] font-semibold tabular-nums">
								{index + 1}
							</span>
							{q.prompt}
						</p>
						<p className="mt-1.5 pl-7 text-sm text-(--desktop-text-primary)">
							{formatSurveyAnswerDisplay(q, answers[q.question_key], t)}
						</p>
					</article>
				))}
			</div>
			<DesktopAppButton type="button" variant="neutral" onClick={onBack}>
				{t('runner.backToList')}
			</DesktopAppButton>
		</DesktopAppPanel>
	);
}
