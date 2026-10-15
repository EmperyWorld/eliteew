/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the four-stage AMKA pipeline timeline for a marketing run (audit/plan → approval → execute → wrap-up).
 *
 * Invariants:
 * - Uses marketing i18n keys under `amkaView.timeline*` and `amkaView.status.*`.
 * - Run data comes from Marketing Cabinet DTOs; no extra fetches.
 *
 * Related:
 * - src/features/amka/amkaTimelineModel.ts
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 */
import { CheckIcon } from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

import type { AmkaRun } from '@/services/amka/marketingCabinetAmkaBridge';
import { amkaRunStatusClass } from '@/features/amka/amkaViewUtils';
import {
	computeAmkaTimelineState,
	timelineConnectorClass,
	type AmkaTimelineStageId,
} from '@/features/amka/amkaTimelineModel';

function stageLabelKey(id: AmkaTimelineStageId): string {
	switch (id) {
		case 'audit_plan':
			return 'amkaView.timeline.auditPlan';
		case 'approval':
			return 'amkaView.timeline.approval';
		case 'execute':
			return 'amkaView.timeline.execute';
		case 'wrap_up':
			return 'amkaView.timeline.wrapUp';
		default:
			return 'amkaView.timeline.auditPlan';
	}
}

export function AmkaPipelineTimeline({ run }: { run: AmkaRun }) {
	const { t } = useTranslation('marketing');
	const { activeIndex, stages } = computeAmkaTimelineState({
		status: run.status,
		current_stage: run.current_stage,
	});

	return (
		<section
			className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 px-3 py-3"
			aria-label={t('amkaView.timelineAria')}
		>
			<div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
				{t('amkaView.timelineTitle')}
			</div>
			<div className="-mx-1 flex flex-nowrap items-start justify-between gap-1 overflow-x-auto pb-1">
				{stages.map((stageId, i) => {
					const done = i < activeIndex || run.status === 'completed';
					const active = i === activeIndex && run.status !== 'completed';
					const label = t(stageLabelKey(stageId));
					return (
						<div
							key={stageId}
							className="flex min-w-0 flex-[1_1_0] items-start gap-1"
						>
							<div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
								<div
									className={cn(
										'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-inset transition-colors',
										done && !active
											? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/35'
											: active
												? cn(
														'bg-[rgb(var(--desktop-accent-rgb)/0.22)] text-(--desktop-text-primary)',
														'ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
													)
												: 'bg-(--desktop-surface-panel) text-(--desktop-text-muted) ring-(--desktop-border-subtle)'
									)}
									aria-current={active ? 'step' : undefined}
								>
									{done && !active ? (
										<CheckIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									) : (
										<span>{i + 1}</span>
									)}
								</div>
								<span
									className={cn(
										'text-[11px] font-medium leading-snug wrap-pretty px-0.5',
										active
											? 'text-(--desktop-text-primary)'
											: 'text-(--desktop-text-secondary)'
									)}
								>
									{label}
								</span>
							</div>
							{i < stages.length - 1 ? (
								<div
									className={cn(
										'mx-0.5 mt-4 hidden h-px min-w-5 shrink sm:block',
										timelineConnectorClass(i < activeIndex)
									)}
									aria-hidden
								/>
							) : null}
						</div>
					);
				})}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-(--desktop-border-subtle) pt-2">
				<span
					className={cn(
						'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
						amkaRunStatusClass(run.status)
					)}
				>
					{t(`amkaView.status.${run.status}`)}
				</span>
				{run.progress_message ? (
					<span className="text-xs text-(--desktop-text-secondary) wrap-pretty">
						{run.progress_message}
					</span>
				) : null}
			</div>
		</section>
	);
}
