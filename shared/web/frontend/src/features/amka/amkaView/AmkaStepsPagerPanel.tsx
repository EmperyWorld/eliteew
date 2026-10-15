/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Steps pager wrapping AmkaStepRunningBanner and AmkaStepDetailBody.
 *
 * Related:
 * - AmkaView.tsx, AmkaStepRunningBanner.tsx
 */

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { AmkaStepRunningBanner } from '@/features/amka/AmkaStepRunningBanner';
import { AmkaStepDetailBody } from '@/features/amka/AmkaStepDetailBody';
import { resolveAmkaStepExecutionMode } from '@/features/amka/amkaViewUtils';
import {
	MarketingCabinetSelect,
	type AmkaRunStep,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { cn } from '@/utils/cn';

type SelectOption = {
	value: string;
	label: string;
	description?: string;
};

type AmkaStepsPagerPanelProps = {
	steps: AmkaRunStep[];
	stepPageSafeIndex: number;
	runningStepIndex: number | null;
	runningStep: AmkaRunStep | null;
	currentStep: AmkaRunStep | null;
	stepJumpSelectOptions: SelectOption[];
	busy: boolean;
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
	onOpenAiStudio?: () => void;
	onStepPageIndexChange: (index: number) => void;
};

export function AmkaStepsPagerPanel({
	steps,
	stepPageSafeIndex,
	runningStepIndex,
	runningStep,
	currentStep,
	stepJumpSelectOptions,
	busy,
	selectedCompanyId,
	selectedProjectId,
	onOpenAiStudio,
	onStepPageIndexChange,
}: AmkaStepsPagerPanelProps) {
	const { t } = useTranslation('marketing');

	return (
		<details className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-2.5">
			<summary
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'cursor-pointer list-none font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden'
				)}
				aria-label={t('amkaView.spoilerStepsAria')}
			>
				{t('amkaView.spoilerStepsSummary')}
			</summary>
			<div className="mt-3 space-y-3">
				<h4 className="sr-only">{t('amkaView.stepsTitle')}</h4>
				{steps.length === 0 ? (
					<p className="text-sm text-(--desktop-text-secondary)">
						{t('amkaView.noSteps')}
					</p>
				) : (
					<div
						className={cn(
							'flex max-h-[min(70vh,28rem)] min-h-56 flex-col overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40'
						)}
					>
						<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-elevated)/50 px-2 py-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 w-8 shrink-0 p-0"
								disabled={stepPageSafeIndex <= 0 || busy}
								aria-label={t('amkaView.stepsPagerPrevAria')}
								onClick={() =>
									onStepPageIndexChange(Math.max(0, stepPageSafeIndex - 1))
								}
							>
								<ChevronLeftIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'shrink-0 tabular-nums text-(--desktop-text-secondary)'
								)}
							>
								{t('amkaView.stepsPagerCounter', {
									current: stepPageSafeIndex + 1,
									total: steps.length,
								})}
							</span>
							<div className="min-w-0 flex-1">
								<span className="sr-only">
									{t('amkaView.stepsPagerJumpLabel')}
								</span>
								<MarketingCabinetSelect
									size="compact"
									className="min-w-0 w-full"
									aria-label={t('amkaView.stepsPagerJumpLabel')}
									value={String(stepPageSafeIndex)}
									disabled={busy}
									options={stepJumpSelectOptions}
									onChange={(v) => {
										const i = Number.parseInt(v, 10);
										if (Number.isFinite(i)) {
											onStepPageIndexChange(
												Math.min(Math.max(0, i), steps.length - 1)
											);
										}
									}}
								/>
							</div>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 w-8 shrink-0 p-0"
								disabled={stepPageSafeIndex >= steps.length - 1 || busy}
								aria-label={t('amkaView.stepsPagerNextAria')}
								onClick={() =>
									onStepPageIndexChange(
										Math.min(steps.length - 1, stepPageSafeIndex + 1)
									)
								}
							>
								<ChevronRightIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
						</div>
						<AmkaStepRunningBanner
							runningStep={
								runningStep
									? {
											ordinal: runningStep.ordinal,
											title: runningStep.title,
											executionMode: resolveAmkaStepExecutionMode(runningStep),
										}
									: null
							}
							stepPageSafeIndex={stepPageSafeIndex}
							runningStepIndex={runningStepIndex}
							t={t}
						/>
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
							{currentStep ? (
								<AmkaStepDetailBody
									step={currentStep}
									onOpenAiStudio={onOpenAiStudio}
									selectedCompanyId={selectedCompanyId}
									selectedProjectId={selectedProjectId}
								/>
							) : null}
						</div>
					</div>
				)}
			</div>
		</details>
	);
}
