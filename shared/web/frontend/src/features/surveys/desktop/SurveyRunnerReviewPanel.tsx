/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Review step with incomplete-answer highlighting and summary before submit.
 */
import { cn } from '@/utils/cn';
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { formatSurveyAnswerDisplay } from './surveyAnswerFormat';
import {
	SH_RUNNER_QUESTION_PANEL_CLASS,
	SH_RUNNER_REVIEW_CARD_CLASS,
	SH_RUNNER_STEP_BADGE_CLASS,
} from './surveyHubLayoutTokens';
import {
	collectSurveyReviewIssues,
	isSurveyAnswerProvided,
	type SurveyAnswerErrorKey,
} from './surveyRunnerValidation';
import { SurveyRunnerActionBar } from './SurveyRunnerActionBar';

type Props = {
	questions: SurveyQuestion[];
	answers: Record<string, unknown>;
	previewMode: boolean;
	submitting: boolean;
	panelRef: React.RefObject<HTMLDivElement | null>;
	onJumpToQuestion: (index: number) => void;
	onSubmit: () => void;
	onEdit: () => void;
	onCancel: () => void;
};

export function SurveyRunnerReviewPanel({
	questions,
	answers,
	previewMode,
	submitting,
	panelRef,
	onJumpToQuestion,
	onSubmit,
	onEdit,
	onCancel,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const issues = React.useMemo(
		() => collectSurveyReviewIssues(questions, answers),
		[answers, questions]
	);
	const incompleteKeys = React.useMemo(
		() => new Set(issues.map((item) => item.questionKey)),
		[issues]
	);
	const issueByKey = React.useMemo(() => {
		const map = new Map<string, SurveyAnswerErrorKey>();
		for (const item of issues) {
			map.set(item.questionKey, item.errorKey);
		}
		return map;
	}, [issues]);

	return (
		<div ref={panelRef} className={SH_RUNNER_QUESTION_PANEL_CLASS}>
			<header className="space-y-2">
				<span className={SH_RUNNER_STEP_BADGE_CLASS}>
					{t('runner.stepReview')}
				</span>
				<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
					{t('runner.reviewTitle')}
				</h2>
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('runner.reviewHint')}</p>
				{issues.length > 0 ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'flex items-center gap-1.5 rounded-(--desktop-radius) border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-100/95'
						)}
						role="status"
					>
						<ExclamationTriangleIcon
							className="h-4 w-4 shrink-0"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('runner.reviewIncompleteSummary', { count: issues.length })}
					</p>
				) : null}
			</header>
			<div className="mt-5 space-y-3">
				{questions.map((q, index) => {
					const complete = isSurveyAnswerProvided(
						answers[q.question_key],
						q.question_type
					);
					const incomplete = incompleteKeys.has(q.question_key);
					const errorKey = issueByKey.get(q.question_key);
					return (
						<button
							key={q.question_key}
							type="button"
							className={cn(
								SH_RUNNER_REVIEW_CARD_CLASS,
								'text-left',
								incomplete && 'border-amber-500/45 ring-1 ring-amber-500/25',
								complete &&
									!incomplete &&
									'border-[rgb(var(--desktop-accent-rgb)/0.22)]'
							)}
							onClick={() => onJumpToQuestion(index)}
						>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'flex items-center gap-2 text-(--desktop-text-muted)'
								)}
							>
								<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--desktop-surface-panel) text-[10px] font-semibold tabular-nums">
									{index + 1}
								</span>
								<span className="min-w-0 flex-1">{q.prompt}</span>
								{complete && !incomplete ? (
									<CheckCircleIcon
										className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								) : incomplete ? (
									<ExclamationTriangleIcon
										className="h-4 w-4 shrink-0 text-amber-400"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								) : null}
							</p>
							<p className="mt-1.5 pl-7 text-sm text-(--desktop-text-primary)">
								{complete
									? formatSurveyAnswerDisplay(q, answers[q.question_key], t)
									: t('runner.reviewMissingAnswer')}
							</p>
							{errorKey ? (
								<p
									className={cn(
										'mt-1 pl-7',
										DESKTOP_TYPOGRAPHY.caption,
										'text-amber-300/90'
									)}
								>
									{t(`runner.errors.${errorKey}`, {
										defaultValue: t('runner.errors.invalid'),
									})}
								</p>
							) : null}
							<p className={cn('mt-1.5 pl-7', DESKTOP_TYPOGRAPHY.caption)}>
								{t('runner.reviewEditHint')}
							</p>
						</button>
					);
				})}
			</div>
			<SurveyRunnerActionBar
				primaryLabel={
					previewMode
						? t('admin.userPreview.close')
						: submitting
							? t('runner.submitting')
							: t('runner.submit')
				}
				primaryDisabled={!previewMode && submitting}
				primaryReady
				showPrimaryIcon
				primaryIcon="submit"
				onPrimary={onSubmit}
				secondaryLabel={t('runner.edit')}
				onSecondary={onEdit}
				onCancel={onCancel}
			/>
		</div>
	);
}
