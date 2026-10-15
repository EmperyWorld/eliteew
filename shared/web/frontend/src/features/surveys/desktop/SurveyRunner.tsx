/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Survey runner orchestrator: intro, session resume, steps, review, submit, success.
 *
 * Invariants:
 * - One accent primary action in the sticky action bar per step.
 * - Tab-local session persists until submit or confirmed exit.
 *
 * Related:
 * - useSurveyRunnerFlow.ts · SURVEY-HUB.md
 */
import { cn } from '@/utils/cn';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type {
	SurveySubmitResult,
	SurveyUserDetail,
} from '@/pages/Desktop/services/productDesktopSurveysApi';
import { SurveyQuestionStep } from './SurveyQuestionStep';
import { computeRunnerProgress } from './surveyHubUserUtils';
import { SurveyRunnerHero } from './SurveyRunnerHero';
import { SurveyRunnerExitConfirm } from './SurveyRunnerExitConfirm';
import { SurveyRunnerIntro } from './SurveyRunnerIntro';
import { SurveyRunnerActionBar } from './SurveyRunnerActionBar';
import { SurveyRunnerReadOnlyPanel } from './SurveyRunnerReadOnlyPanel';
import { SurveyRunnerReviewPanel } from './SurveyRunnerReviewPanel';
import { SurveyRunnerResumeBanner } from './SurveyRunnerResumeBanner';
import { SurveyRunnerSuccessPanel } from './SurveyRunnerSuccessPanel';
import { SH_RUNNER_QUESTION_PANEL_CLASS } from './surveyHubLayoutTokens';
import { useSurveyRunnerFlow } from './useSurveyRunnerFlow';

type Props = {
	survey: SurveyUserDetail;
	readOnly?: boolean;
	previewMode?: boolean;
	initialAnswers?: Record<string, unknown>;
	onDone: (result?: SurveySubmitResult) => void;
	onCancel: () => void;
};

export function SurveyRunner({
	survey,
	readOnly = false,
	previewMode = false,
	initialAnswers,
	onDone,
	onCancel,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const reduceMotion = useReducedMotion();
	const questions = React.useMemo(
		() => [...survey.questions].sort((a, b) => a.sort_order - b.sort_order),
		[survey.questions]
	);
	const panelRef = React.useRef<HTMLDivElement>(null);
	const liveRegionRef = React.useRef<HTMLDivElement>(null);

	const flow = useSurveyRunnerFlow({
		survey,
		questions,
		readOnly,
		previewMode,
		initialAnswers,
		onDone,
		onCancel,
		panelRef,
	});

	const progress = computeRunnerProgress({
		step: flow.step,
		questionCount: questions.length,
		review: flow.review,
	});
	const stepLabel = flow.review
		? t('runner.stepReview')
		: t('runner.stepOf', { current: flow.step + 1, total: questions.length });

	React.useEffect(() => {
		if (
			readOnly ||
			flow.review ||
			flow.submitMut.isPending ||
			!flow.introDismissed
		) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== 'Enter' ||
				event.shiftKey ||
				event.ctrlKey ||
				event.metaKey
			) {
				return;
			}
			const target = event.target;
			if (
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLInputElement && target.type !== 'button')
			) {
				return;
			}
			event.preventDefault();
			flow.goNext();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [
		flow.goNext,
		flow.introDismissed,
		flow.review,
		flow.submitMut.isPending,
		readOnly,
	]);

	React.useEffect(() => {
		if (!liveRegionRef.current) return;
		liveRegionRef.current.textContent = `${stepLabel} · ${t(
			'runner.answeredCount',
			{
				answered: flow.answeredCount,
				total: questions.length,
			}
		)}`;
	}, [flow.answeredCount, questions.length, stepLabel, t]);

	if (flow.success) {
		return (
			<SurveyRunnerSuccessPanel
				surveyTitle={survey.title}
				questionCount={questions.length}
				result={flow.success}
				onDone={() => onDone(flow.success ?? undefined)}
			/>
		);
	}

	if (readOnly) {
		return (
			<SurveyRunnerReadOnlyPanel
				surveyTitle={survey.title}
				questions={questions}
				answers={flow.answers}
				onBack={onCancel}
			/>
		);
	}

	if (!flow.introDismissed && !flow.resumePromptOpen) {
		return (
			<SurveyRunnerIntro
				survey={survey}
				questionCount={questions.length}
				onStart={flow.dismissIntro}
				onCancel={flow.requestCancel}
			/>
		);
	}

	return (
		<div className="mx-4 mb-4 flex min-h-0 flex-1 flex-col gap-3">
			{previewMode ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'rounded-(--desktop-radius) border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100/90'
					)}
				>
					{t('admin.userPreview.banner')}
				</p>
			) : null}

			<div ref={liveRegionRef} className="sr-only" aria-live="polite" />

			{flow.resumePromptOpen && flow.storedSession ? (
				<SurveyRunnerResumeBanner
					session={flow.storedSession}
					questionCount={questions.length}
					onContinue={flow.resumeSession}
					onStartFresh={flow.startFresh}
				/>
			) : null}

			<SurveyRunnerHero
				survey={survey}
				questionCount={questions.length}
				answeredCount={flow.answeredCount}
				currentStep={flow.step}
				review={flow.review}
				progress={progress}
				stepLabel={stepLabel}
				onSelectStep={flow.jumpToQuestion}
			/>

			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={flow.review ? 'review' : (flow.current?.question_key ?? 'empty')}
					initial={reduceMotion ? false : { opacity: 0, x: 16 }}
					animate={{ opacity: 1, x: 0 }}
					exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
					transition={{ duration: reduceMotion ? 0 : 0.2 }}
					className="flex min-h-0 flex-1 flex-col"
				>
					{flow.review ? (
						<SurveyRunnerReviewPanel
							questions={questions}
							answers={flow.answers}
							previewMode={previewMode}
							submitting={flow.submitMut.isPending}
							panelRef={panelRef}
							onJumpToQuestion={flow.jumpToQuestion}
							onSubmit={flow.submitFromReview}
							onEdit={flow.exitReview}
							onCancel={flow.requestCancel}
						/>
					) : flow.current ? (
						<div ref={panelRef} className={SH_RUNNER_QUESTION_PANEL_CLASS}>
							<SurveyQuestionStep
								question={flow.current}
								stepIndex={flow.step}
								stepTotal={questions.length}
								value={flow.answers[flow.current.question_key]}
								onChange={(v) =>
									flow.setAnswers((prev) => ({
										...prev,
										[flow.current?.question_key ?? '']: v,
									}))
								}
								errorKey={flow.errorKey}
								onError={flow.setErrorKey}
							/>
							<SurveyRunnerActionBar
								primaryLabel={
									flow.step >= questions.length - 1
										? t('runner.review')
										: t('runner.next')
								}
								primaryDisabled={!flow.canProceedCurrent}
								primaryReady={flow.canProceedCurrent}
								primaryHint={
									!flow.canProceedCurrent
										? t('runner.primaryHintRequired')
										: null
								}
								showPrimaryIcon
								primaryIcon="next"
								onPrimary={flow.goNext}
								showBack={flow.step > 0}
								onBack={() => {
									flow.jumpToQuestion(Math.max(0, flow.step - 1));
								}}
								onCancel={flow.requestCancel}
							/>
						</div>
					) : null}
				</motion.div>
			</AnimatePresence>
			<SurveyRunnerExitConfirm
				open={flow.exitConfirmOpen}
				answeredCount={flow.answeredCount}
				onClose={() => flow.setExitConfirmOpen(false)}
				onConfirmExit={flow.confirmExit}
			/>
		</div>
	);
}
