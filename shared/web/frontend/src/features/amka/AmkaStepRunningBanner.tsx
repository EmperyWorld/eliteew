/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Status strip shown while an AMKA run step is `running`, including focus hint when the user pages away.
 *
 * Invariants:
 * - Presentational only; callers supply step snapshot and indices from run detail.
 *
 * Related:
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 */
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type AmkaStepRunningBannerStep = {
	ordinal: number;
	title: string;
	executionMode?: string | null;
};

export type AmkaStepRunningBannerProps = {
	runningStep: AmkaStepRunningBannerStep | null;
	stepPageSafeIndex: number;
	runningStepIndex: number | null;
	t: TFunction<'marketing'>;
};

export function AmkaStepRunningBanner({
	runningStep,
	stepPageSafeIndex,
	runningStepIndex,
	t,
}: AmkaStepRunningBannerProps) {
	if (!runningStep) return null;

	return (
		<div
			className={cn(
				'shrink-0 border-b border-(--desktop-border-subtle) bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-3 py-2'
			)}
			role="status"
			aria-live="polite"
		>
			<div className="flex min-w-0 items-start gap-2">
				<ArrowPathIcon
					className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-[rgb(var(--desktop-accent-rgb)/0.95)]"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<div className="text-xs font-semibold text-(--desktop-text-primary)">
						{t('amkaView.stepRunningBannerTitle')}
					</div>
					<div className="mt-0.5 text-xs text-(--desktop-text-secondary)">
						#{runningStep.ordinal}{' '}
						{runningStep.title.length > 96
							? `${runningStep.title.slice(0, 96)}…`
							: runningStep.title}
					</div>
					{runningStep.executionMode === 'desktop_ensemble' ? (
						<p className="mt-1 text-[11px] leading-relaxed text-(--desktop-text-muted) wrap-pretty">
							{t('amkaView.ensembleRunningHint')}
						</p>
					) : null}
				</div>
			</div>
			{runningStepIndex !== null && stepPageSafeIndex !== runningStepIndex ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'mt-1.5 text-(--desktop-text-muted)'
					)}
				>
					{t('amkaView.stepsPagerFocusHint')}
				</p>
			) : null}
		</div>
	);
}
