/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-submit success celebration panel for survey runner.
 */
import { cn } from '@/utils/cn';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveySubmitResult } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	SH_RUNNER_REWARD_CHIP_CLASS,
	SH_RUNNER_SUCCESS_PANEL_CLASS,
} from './surveyHubLayoutTokens';

type Props = {
	surveyTitle: string;
	questionCount: number;
	result: SurveySubmitResult;
	onDone: () => void;
};

export function SurveyRunnerSuccessPanel({
	surveyTitle,
	questionCount,
	result,
	onDone,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const r = result.reward_granted;
	const hasReward =
		r.ugs_credits > 0 || r.ew_balance > 0 || r.web_search_coins > 0;

	return (
		<section className={SH_RUNNER_SUCCESS_PANEL_CLASS}>
			<div className="flex items-start gap-3">
				<CheckCircleIcon
					className="mt-0.5 h-9 w-9 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				<div>
					<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
						{t('runner.successTitle')}
					</h2>
					<p className={cn('mt-2', DESKTOP_TYPOGRAPHY.body)}>
						{t('runner.successBodyNamed', {
							title: surveyTitle,
							count: questionCount,
						})}
					</p>
				</div>
			</div>
			{hasReward ? (
				<div className="ml-12 flex flex-wrap gap-2">
					{r.ugs_credits > 0 ? (
						<span className={SH_RUNNER_REWARD_CHIP_CLASS}>
							{t('runner.rewardUgs', { count: r.ugs_credits })}
						</span>
					) : null}
					{r.ew_balance > 0 ? (
						<span className={SH_RUNNER_REWARD_CHIP_CLASS}>
							{t('runner.rewardEw', { count: r.ew_balance })}
						</span>
					) : null}
					{r.web_search_coins > 0 ? (
						<span className={SH_RUNNER_REWARD_CHIP_CLASS}>
							{t('runner.rewardCoins', { count: r.web_search_coins })}
						</span>
					) : null}
				</div>
			) : null}
			<DesktopAppButton
				type="button"
				variant="accent"
				className="ml-12 w-fit"
				onClick={onDone}
			>
				{t('runner.backToList')}
			</DesktopAppButton>
		</section>
	);
}
