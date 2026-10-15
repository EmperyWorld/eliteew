/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single-question survey runner step with premium choices, scale chips, and text inputs.
 *
 * Related:
 * - SurveyRunner.tsx · surveyHubLayoutTokens.ts
 */
import { cn } from '@/utils/cn';
import { CheckIcon } from '@heroicons/react/24/solid';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppInput,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	SH_RUNNER_CHOICE_BASE_CLASS,
	SH_RUNNER_CHOICE_IDLE_CLASS,
	SH_RUNNER_CHOICE_SELECTED_CLASS,
	SH_RUNNER_SCALE_CHIP_CLASS,
	SH_RUNNER_SCALE_CHIP_IDLE_CLASS,
	SH_RUNNER_SCALE_CHIP_SELECTED_CLASS,
	SH_RUNNER_SCALE_VALUE_CLASS,
	SH_RUNNER_STEP_BADGE_CLASS,
	SH_RUNNER_TEXTAREA_CLASS,
} from './surveyHubLayoutTokens';
import {
	surveyNpsSemanticLabel,
	surveyNumericBounds,
	surveyScaleEndpointLabels,
	textMaxLength,
	validateSurveyStepAnswer,
	type SurveyAnswerErrorKey,
} from './surveyRunnerValidation';

type Props = {
	question: SurveyQuestion;
	stepIndex: number;
	stepTotal: number;
	value: unknown;
	onChange: (next: unknown) => void;
	readOnly?: boolean;
	errorKey: SurveyAnswerErrorKey | null;
	onError: (key: SurveyAnswerErrorKey | null) => void;
};

function choiceClass(selected: boolean, readOnly: boolean): string {
	return cn(
		SH_RUNNER_CHOICE_BASE_CLASS,
		DESKTOP_CHROME_FOCUS_VISIBLE,
		selected ? SH_RUNNER_CHOICE_SELECTED_CLASS : SH_RUNNER_CHOICE_IDLE_CLASS,
		readOnly && 'cursor-default opacity-80',
		selected && 'pr-10 relative'
	);
}

function ScaleQuickPick({
	min,
	max,
	value,
	readOnly,
	onPick,
}: {
	min: number;
	max: number;
	value: number;
	readOnly: boolean;
	onPick: (next: number) => void;
}): React.ReactElement {
	const values = React.useMemo(
		() => Array.from({ length: max - min + 1 }, (_, index) => min + index),
		[min, max]
	);

	return (
		<fieldset className="m-0 min-w-0 border-0 p-0">
			<legend className="sr-only">{`${min}–${max}`}</legend>
			<div className="flex flex-wrap justify-center gap-2">
				{values.map((num) => {
					const selected = value === num;
					return (
						<button
							key={num}
							type="button"
							disabled={readOnly}
							aria-pressed={selected}
							className={cn(
								SH_RUNNER_SCALE_CHIP_CLASS,
								DESKTOP_CHROME_FOCUS_VISIBLE,
								selected
									? SH_RUNNER_SCALE_CHIP_SELECTED_CLASS
									: SH_RUNNER_SCALE_CHIP_IDLE_CLASS
							)}
							onClick={() => onPick(num)}
						>
							{num}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

export function SurveyQuestionStep({
	question,
	stepIndex,
	stepTotal,
	value,
	onChange,
	readOnly = false,
	errorKey,
	onError,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const choices =
		(question.options_json?.choices as string[] | undefined) ?? [];
	const numericBounds = surveyNumericBounds(question);
	const min = numericBounds?.min ?? 1;
	const max = numericBounds?.max ?? 5;
	const displayValue = typeof value === 'number' ? value : min;
	const textValue = typeof value === 'string' ? value : '';
	const maxChars = textMaxLength(question);
	const endpointLabels = surveyScaleEndpointLabels(question);
	const npsLabelKey = surveyNpsSemanticLabel(displayValue, max);

	const pickChoice = React.useCallback(
		(choice: string) => {
			if (readOnly) return;
			onChange(choice);
			onError(null);
		},
		[onChange, onError, readOnly]
	);

	const pickMulti = React.useCallback(
		(choice: string) => {
			if (readOnly) return;
			const current = Array.isArray(value) ? [...value.map(String)] : [];
			const idx = current.indexOf(choice);
			if (idx >= 0) current.splice(idx, 1);
			else current.push(choice);
			onChange(current);
			onError(
				validateSurveyStepAnswer(question, current.length ? current : null)
			);
		},
		[onChange, onError, question, readOnly, value]
	);

	const pickScale = React.useCallback(
		(num: number) => {
			if (readOnly) return;
			onChange(num);
			onError(null);
		},
		[onChange, onError, readOnly]
	);

	const choiceOptions = React.useMemo(() => {
		if (question.question_type === 'yes_no') {
			return [
				{ id: true, label: t('runner.yes') },
				{ id: false, label: t('runner.no') },
			];
		}
		return choices.map((c) => ({ id: c, label: c }));
	}, [choices, question.question_type, t]);

	React.useEffect(() => {
		if (readOnly) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLInputElement &&
					target.type !== 'button' &&
					target.type !== 'range')
			) {
				return;
			}

			if (
				question.question_type === 'single_choice' ||
				question.question_type === 'yes_no' ||
				question.question_type === 'multi_choice'
			) {
				if (choiceOptions.length > 10) return;
				const digit =
					event.key >= '1' && event.key <= '9'
						? Number(event.key) - 1
						: event.key === '0'
							? 9
							: -1;
				if (digit < 0 || digit >= choiceOptions.length) return;
				event.preventDefault();
				const item = choiceOptions[digit];
				if (question.question_type === 'multi_choice') {
					pickMulti(String(item.id));
					return;
				}
				if (question.question_type === 'yes_no') {
					onChange(item.id);
					onError(null);
					return;
				}
				pickChoice(String(item.id));
				return;
			}

			if (
				question.question_type === 'scale' ||
				question.question_type === 'nps'
			) {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
				const active = document.activeElement;
				const inScale =
					active instanceof HTMLInputElement && active.type === 'range';
				const onChip =
					active instanceof HTMLButtonElement &&
					active.getAttribute('aria-pressed') !== null;
				if (!inScale && !onChip) return;
				event.preventDefault();
				const delta = event.key === 'ArrowRight' ? 1 : -1;
				const next = Math.min(max, Math.max(min, displayValue + delta));
				pickScale(next);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [
		choiceOptions,
		displayValue,
		max,
		min,
		onChange,
		onError,
		pickChoice,
		pickMulti,
		pickScale,
		question.question_type,
		readOnly,
	]);

	const renderChoiceLabel = (label: string, selected: boolean) => (
		<span className="flex w-full items-center justify-between gap-2">
			<span>{label}</span>
			{selected ? (
				<CheckIcon
					className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[rgb(var(--desktop-accent-rgb))]"
					aria-hidden
				/>
			) : null}
		</span>
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-5">
			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<span className={SH_RUNNER_STEP_BADGE_CLASS}>
						{t('runner.stepOf', {
							current: stepIndex + 1,
							total: stepTotal,
						})}
					</span>
					{question.required ? (
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-muted)'
							)}
						>
							{t('runner.requiredMark')}
						</span>
					) : null}
				</div>
				<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>{question.prompt}</h2>
				{question.help_text ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'text-(--desktop-text-muted)'
						)}
					>
						{question.help_text}
					</p>
				) : null}
				{question.question_type === 'multi_choice' ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-dim)'
						)}
					>
						{t('runner.multiHint')}
					</p>
				) : null}
			</header>

			{question.question_type === 'single_choice' ||
			question.question_type === 'yes_no' ? (
				<div className="grid gap-2.5 sm:grid-cols-2" role="listbox">
					{choiceOptions.map((item, index) => {
						const selected =
							question.question_type === 'yes_no'
								? value === item.id
								: value === item.id;
						return (
							<button
								key={String(item.id)}
								type="button"
								disabled={readOnly}
								role="option"
								aria-selected={selected}
								className={choiceClass(selected, readOnly)}
								onClick={() => {
									if (question.question_type === 'yes_no') {
										if (readOnly) return;
										onChange(item.id);
										onError(null);
										return;
									}
									pickChoice(String(item.id));
								}}
							>
								{renderChoiceLabel(
									choiceOptions.length <= 10
										? `${index + 1}. ${item.label}`
										: item.label,
									selected
								)}
							</button>
						);
					})}
				</div>
			) : null}

			{question.question_type === 'multi_choice' ? (
				<div className="grid gap-2.5 sm:grid-cols-2">
					{choices.map((c, index) => {
						const selected =
							Array.isArray(value) && value.map(String).includes(c);
						return (
							<button
								key={c}
								type="button"
								disabled={readOnly}
								aria-pressed={selected}
								className={choiceClass(Boolean(selected), readOnly)}
								onClick={() => pickMulti(c)}
							>
								{renderChoiceLabel(
									choices.length <= 10 ? `${index + 1}. ${c}` : c,
									Boolean(selected)
								)}
							</button>
						);
					})}
				</div>
			) : null}

			{question.question_type === 'scale' ||
			question.question_type === 'nps' ? (
				<div className="space-y-4">
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{question.question_type === 'nps'
							? t('runner.npsHint', { min, max })
							: t('runner.scaleHint', { min, max })}
					</p>
					<div className="flex flex-col items-center gap-1">
						<span className={SH_RUNNER_SCALE_VALUE_CLASS}>{displayValue}</span>
						{npsLabelKey ? (
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t(`runner.npsLabel.${npsLabelKey}`)}
							</span>
						) : null}
					</div>
					<ScaleQuickPick
						min={min}
						max={max}
						value={displayValue}
						readOnly={readOnly}
						onPick={pickScale}
					/>
					<input
						type="range"
						min={min}
						max={max}
						value={displayValue}
						disabled={readOnly}
						className="w-full accent-(--desktop-accent)"
						aria-valuemin={min}
						aria-valuemax={max}
						aria-valuenow={displayValue}
						onChange={(e) => pickScale(Number(e.target.value))}
					/>
					<div className="flex justify-between gap-3 text-sm text-(--desktop-text-muted)">
						<span>
							{endpointLabels.minLabel ??
								(question.question_type === 'nps'
									? t('runner.npsEndpointMin', { min })
									: String(min))}
						</span>
						<span>
							{endpointLabels.maxLabel ??
								(question.question_type === 'nps'
									? t('runner.npsEndpointMax', { max })
									: String(max))}
						</span>
					</div>
				</div>
			) : null}

			{question.question_type === 'text_short' ? (
				<div className="space-y-1.5">
					<DesktopAppInput
						className={cn('w-full', DESKTOP_CHROME_FOCUS_VISIBLE)}
						value={textValue}
						readOnly={readOnly}
						maxLength={maxChars}
						placeholder={t('runner.textPlaceholder')}
						onChange={(e) => {
							onChange(e.target.value);
							onError(null);
						}}
					/>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-right tabular-nums',
							textValue.length > maxChars * 0.9
								? 'text-amber-300/90'
								: 'text-(--desktop-text-dim)'
						)}
					>
						{t('runner.charCount', {
							current: textValue.length,
							max: maxChars,
						})}
					</p>
				</div>
			) : null}

			{question.question_type === 'text_long' ? (
				<div className="space-y-1.5">
					<textarea
						className={cn(
							SH_RUNNER_TEXTAREA_CLASS,
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						value={textValue}
						readOnly={readOnly}
						maxLength={maxChars}
						placeholder={t('runner.textPlaceholder')}
						rows={6}
						onChange={(e) => {
							onChange(e.target.value);
							onError(null);
						}}
					/>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-right tabular-nums',
							textValue.length > maxChars * 0.9
								? 'text-amber-300/90'
								: 'text-(--desktop-text-dim)'
						)}
					>
						{t('runner.charCount', {
							current: textValue.length,
							max: maxChars,
						})}
					</p>
				</div>
			) : null}

			{errorKey ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-rose-400')}
					role="alert"
				>
					{t(`runner.errors.${errorKey}`, {
						defaultValue: t('runner.errors.invalid'),
					})}
				</p>
			) : null}
		</div>
	);
}
