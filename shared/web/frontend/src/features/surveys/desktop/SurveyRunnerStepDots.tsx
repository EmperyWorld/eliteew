/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Numbered step pills for survey runner progress (compact dots fallback for long surveys).
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	SH_RUNNER_STEP_PILL_ACTIVE_CLASS,
	SH_RUNNER_STEP_PILL_CLASS,
	SH_RUNNER_STEP_PILL_DONE_CLASS,
	SH_RUNNER_STEP_PILL_IDLE_CLASS,
} from './surveyHubLayoutTokens';

const MAX_NUMBERED_STEPS = 12;

type Props = {
	questionCount: number;
	currentStep: number;
	review: boolean;
	readOnly?: boolean;
	onSelectStep?: (index: number) => void;
};

function stepPillClass(done: boolean, active: boolean): string {
	if (done) return SH_RUNNER_STEP_PILL_DONE_CLASS;
	if (active) return SH_RUNNER_STEP_PILL_ACTIVE_CLASS;
	return SH_RUNNER_STEP_PILL_IDLE_CLASS;
}

export function SurveyRunnerStepDots({
	questionCount,
	currentStep,
	review,
	readOnly = false,
	onSelectStep,
}: Props): React.ReactElement | null {
	const { t } = useTranslation('surveys');
	if (questionCount <= 1) return null;

	const useNumbered = questionCount <= MAX_NUMBERED_STEPS;

	return (
		<ul
			className="flex flex-wrap items-center gap-1.5"
			aria-label={t('runner.stepDotsAria')}
		>
			{Array.from({ length: questionCount }, (_, index) => {
				const stepKey = `step-dot-${index + 1}`;
				const done = review || index < currentStep;
				const active = !review && index === currentStep;
				const isFuture = !review && index > currentStep;
				const canJump = Boolean(onSelectStep) && !readOnly && (done || active);
				const className = cn(
					useNumbered
						? SH_RUNNER_STEP_PILL_CLASS
						: 'h-2.5 w-2.5 rounded-full border',
					!useNumbered &&
						(done
							? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb))]'
							: active
								? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb)/0.35)]'
								: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'),
					useNumbered && stepPillClass(done, active)
				);
				if (!canJump) {
					return (
						<li key={stepKey}>
							<span
								className={className}
								aria-current={active ? 'step' : undefined}
								aria-disabled={isFuture ? true : undefined}
							>
								{useNumbered ? index + 1 : null}
							</span>
						</li>
					);
				}
				return (
					<li key={stepKey}>
						<button
							type="button"
							className={cn(className, DESKTOP_CHROME_FOCUS_VISIBLE)}
							aria-label={t('runner.stepDot', { index: index + 1 })}
							aria-current={active ? 'step' : undefined}
							onClick={() => onSelectStep?.(index)}
						>
							{useNumbered ? index + 1 : null}
						</button>
					</li>
				);
			})}
			{review ? (
				<li>
					<span
						className={cn(
							'ml-1 rounded-full border border-[rgb(var(--desktop-accent-rgb))] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--desktop-accent-rgb))]'
						)}
					>
						{t('runner.stepReview')}
					</span>
				</li>
			) : null}
		</ul>
	);
}
