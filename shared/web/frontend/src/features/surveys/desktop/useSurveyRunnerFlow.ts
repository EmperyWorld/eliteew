/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Survey runner state, session persistence, submit, and navigation handlers.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
	SurveyQuestion,
	SurveySubmitResult,
	SurveyUserDetail,
} from '@/pages/Desktop/services/productDesktopSurveysApi';
import { submitSurveyResponse } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	clearSurveyRunnerIntroDismissed,
	clearSurveyRunnerSession,
	hasRestorableSurveyRunnerSession,
	persistSurveyRunnerIntroDismissed,
	persistSurveyRunnerSession,
	readSurveyRunnerIntroDismissed,
	readSurveyRunnerSession,
} from './surveyRunnerSession';
import {
	countSurveyAnsweredQuestions,
	surveyNumericBounds,
	surveySubmitDetailToErrorKey,
	validateAllSurveyAnswers,
	validateSurveyStepAnswer,
	type SurveyAnswerErrorKey,
} from './surveyRunnerValidation';

type Args = {
	survey: SurveyUserDetail;
	questions: SurveyQuestion[];
	readOnly: boolean;
	previewMode: boolean;
	initialAnswers?: Record<string, unknown>;
	onDone: (result?: SurveySubmitResult) => void;
	onCancel: () => void;
	panelRef: React.RefObject<HTMLDivElement | null>;
};

export function useSurveyRunnerFlow({
	survey,
	questions,
	readOnly,
	previewMode,
	initialAnswers,
	onDone,
	onCancel,
	panelRef,
}: Args) {
	const { t } = useTranslation('surveys');
	const storedSession = React.useMemo(
		() => (readOnly || previewMode ? null : readSurveyRunnerSession(survey.id)),
		[previewMode, readOnly, survey.id]
	);

	const [step, setStep] = React.useState(() => storedSession?.step ?? 0);
	const [review, setReview] = React.useState(
		() => storedSession?.review ?? false
	);
	const [answers, setAnswers] = React.useState<Record<string, unknown>>(
		() => initialAnswers ?? storedSession?.answers ?? {}
	);
	const [errorKey, setErrorKey] = React.useState<SurveyAnswerErrorKey | null>(
		null
	);
	const [success, setSuccess] = React.useState<SurveySubmitResult | null>(null);
	const [exitConfirmOpen, setExitConfirmOpen] = React.useState(false);
	const [introDismissed, setIntroDismissed] = React.useState(() =>
		previewMode || readOnly
			? true
			: readSurveyRunnerIntroDismissed(survey.id) ||
				hasRestorableSurveyRunnerSession(storedSession)
	);
	const [resumePromptOpen, setResumePromptOpen] = React.useState(
		() =>
			!readOnly &&
			!previewMode &&
			hasRestorableSurveyRunnerSession(storedSession)
	);

	const current: SurveyQuestion | undefined = questions[step];

	React.useEffect(() => {
		if (readOnly || review || previewMode || !current) return;
		const bounds = surveyNumericBounds(current);
		if (!bounds) return;
		setAnswers((prev) => {
			if (typeof prev[current.question_key] === 'number') return prev;
			return { ...prev, [current.question_key]: bounds.min };
		});
	}, [current, previewMode, readOnly, review]);

	React.useEffect(() => {
		if (readOnly || previewMode) return;
		persistSurveyRunnerSession(survey.id, { step, review, answers });
	}, [answers, previewMode, readOnly, review, step, survey.id]);

	const answeredCount = React.useMemo(
		() => countSurveyAnsweredQuestions(questions, answers),
		[answers, questions]
	);

	const canProceedCurrent = React.useMemo(() => {
		if (!current) return false;
		return (
			validateSurveyStepAnswer(current, answers[current.question_key]) === null
		);
	}, [answers, current]);

	const scrollPanelTop = React.useCallback(() => {
		requestAnimationFrame(() => {
			panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
			const focusable = panelRef.current?.querySelector<HTMLElement>(
				'button:not([disabled]), textarea, input[type="range"], input:not([type="button"])'
			);
			focusable?.focus({ preventScroll: true });
		});
	}, [panelRef]);

	const submitMut = useMutation({
		mutationFn: () =>
			submitSurveyResponse(survey.id, {
				answers,
				client_meta: { source: 'desktop' },
			}),
		onSuccess: (result) => {
			clearSurveyRunnerSession(survey.id);
			clearSurveyRunnerIntroDismissed(survey.id);
			setSuccess(result);
		},
		onError: (err: unknown) => {
			const detail =
				err instanceof Error && err.message ? err.message : String(err);
			const errorKeyFromApi = detail
				? surveySubmitDetailToErrorKey(detail)
				: null;
			if (errorKeyFromApi) {
				toast.error(
					t(`runner.errors.${errorKeyFromApi}`, {
						defaultValue: t('runner.errors.invalid'),
					})
				);
				return;
			}
			toast.error(detail || t('runner.submitFailed'));
		},
	});

	const submitFromReview = () => {
		if (previewMode) {
			onDone();
			return;
		}
		const failure = validateAllSurveyAnswers(questions, answers);
		if (failure) {
			const stepIndex = questions.findIndex(
				(q) => q.question_key === failure.questionKey
			);
			setReview(false);
			if (stepIndex >= 0) setStep(stepIndex);
			setErrorKey(failure.errorKey);
			toast.error(
				t(`runner.errors.${failure.errorKey}`, {
					defaultValue: t('runner.errors.invalid'),
				})
			);
			return;
		}
		submitMut.mutate();
	};

	const goNext = React.useCallback(() => {
		if (!current) return;
		const err = validateSurveyStepAnswer(
			current,
			answers[current.question_key]
		);
		if (err) {
			setErrorKey(err);
			return;
		}
		if (step >= questions.length - 1) {
			setReview(true);
			scrollPanelTop();
			return;
		}
		setStep((s) => s + 1);
		setErrorKey(null);
		scrollPanelTop();
	}, [answers, current, questions.length, scrollPanelTop, step]);

	const jumpToQuestion = (index: number) => {
		setReview(false);
		setStep(index);
		setErrorKey(null);
		scrollPanelTop();
	};

	const confirmExit = () => {
		clearSurveyRunnerSession(survey.id);
		clearSurveyRunnerIntroDismissed(survey.id);
		onCancel();
	};

	const requestCancel = () => {
		if (previewMode || readOnly || answeredCount === 0) {
			if (!previewMode && !readOnly) {
				clearSurveyRunnerSession(survey.id);
			}
			onCancel();
			return;
		}
		setExitConfirmOpen(true);
	};

	const resumeSession = () => {
		if (!storedSession) {
			setResumePromptOpen(false);
			return;
		}
		setStep(Math.min(storedSession.step, Math.max(0, questions.length - 1)));
		setReview(storedSession.review);
		setAnswers(storedSession.answers);
		setIntroDismissed(true);
		persistSurveyRunnerIntroDismissed(survey.id);
		setResumePromptOpen(false);
		setErrorKey(null);
	};

	const startFresh = () => {
		clearSurveyRunnerSession(survey.id);
		clearSurveyRunnerIntroDismissed(survey.id);
		setStep(0);
		setReview(false);
		setAnswers({});
		setErrorKey(null);
		setIntroDismissed(false);
		setResumePromptOpen(false);
	};

	const dismissIntro = () => {
		persistSurveyRunnerIntroDismissed(survey.id);
		setIntroDismissed(true);
	};

	const exitReview = () => {
		setReview(false);
	};

	return {
		storedSession,
		step,
		review,
		answers,
		setAnswers,
		errorKey,
		setErrorKey,
		success,
		exitConfirmOpen,
		setExitConfirmOpen,
		introDismissed,
		resumePromptOpen,
		current,
		answeredCount,
		canProceedCurrent,
		submitMut,
		submitFromReview,
		goNext,
		jumpToQuestion,
		confirmExit,
		requestCancel,
		resumeSession,
		startFresh,
		dismissIntro,
		exitReview,
	};
}
