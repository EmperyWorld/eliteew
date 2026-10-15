/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop left-rail «Ваш план» section — read-only roadmap + task completion (U8.3 slice 9).
 *
 * Invariants:
 * - Hidden when ``visible`` is false (plans feature disabled on API).
 *
 * Related:
 * - src/features/ewa/companionPlanStripUi.ts
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 */

import {
	ArrowPathIcon,
	CheckCircleIcon,
	ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
	CompanionLeftRailSection,
	type CompanionLeftRailSectionId,
} from '@/features/ewa/companionLeftRailSection';
import {
	companionPlanStatusIconId,
	companionPlanStatusIconTone,
	companionPlanStatusLabelKey,
	type CompanionPlanFsmStatus,
	isCompanionPlanTaskOverdue,
	parseCompanionPlanDueDate,
	resolveCompanionPlanGoalProgress,
} from '@/features/ewa/companionPlanStripUi';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	EwaCompanionPlanBundle,
	EwaCompanionPlanGoal,
	EwaCompanionPlanTask,
} from '@/services/ewa/ewaCompanionPlansApi';
import { cn } from '@/utils/cn';

export type CompanionLeftRailPlanSectionProps = {
	visible: boolean;
	activePlanBundle: EwaCompanionPlanBundle | null;
	leftRailExpanded: CompanionLeftRailSectionId | null;
	onToggleSection: (sectionId: CompanionLeftRailSectionId) => void;
	planFsmStatus: CompanionPlanFsmStatus;
	planDisplayProgress: number;
	planRefreshing: boolean;
	onRefreshPlan: () => void;
	planGoalsSorted: readonly EwaCompanionPlanGoal[];
	planTaskPartition: {
		open: readonly EwaCompanionPlanTask[];
		done: readonly EwaCompanionPlanTask[];
	};
	completingPlanTaskId: string | null;
	pending: boolean;
	onCompleteTask: (taskId: string) => void;
	archivingPlan: boolean;
	onArchivePlan: () => void;
	reducedMotion: boolean;
};

export function CompanionLeftRailPlanSection({
	visible,
	activePlanBundle,
	leftRailExpanded,
	onToggleSection,
	planFsmStatus,
	planDisplayProgress,
	planRefreshing,
	onRefreshPlan,
	planGoalsSorted,
	planTaskPartition,
	completingPlanTaskId,
	pending,
	onCompleteTask,
	archivingPlan,
	onArchivePlan,
	reducedMotion,
}: CompanionLeftRailPlanSectionProps) {
	const { t, i18n } = useTranslation('marketing');

	if (!visible) return null;

	return (
		<div className="flex min-h-0 min-w-0 shrink-0 flex-col">
			{activePlanBundle?.plan ? (
				<CompanionLeftRailSection
					sectionId="plan"
					expandedSection={leftRailExpanded}
					onToggle={onToggleSection}
					icon="icon-ewa-analytics"
					iconTone="brand"
					title={t('ewaCompanion.planStripTitle')}
					badge={t('ewaCompanion.planProgress', {
						percent: planDisplayProgress,
					})}
				>
					<div className={cn('space-y-2')}>
						<div className="flex items-center gap-2">
							<EwaIcon
								name={companionPlanStatusIconId(planFsmStatus)}
								size="sm"
								tone={companionPlanStatusIconTone(planFsmStatus)}
								pulse={planFsmStatus === 'progress' && !reducedMotion}
								spin={planFsmStatus === 'wait' && !reducedMotion}
								className="shrink-0"
							/>
							<p className="min-w-0 flex-1 text-[11px] font-medium text-(--companion-text-soft)">
								{t(companionPlanStatusLabelKey(planFsmStatus))}
							</p>
							<button
								type="button"
								className={cn(
									'inline-flex size-7 shrink-0 items-center justify-center rounded-md',
									'border border-(--companion-divider) bg-(--desktop-surface-soft)/40',
									'text-(--companion-text-soft) hover:text-(--desktop-text-primary)',
									DESKTOP_CHROME_FOCUS_VISIBLE,
									planRefreshing && 'cursor-wait opacity-60'
								)}
								disabled={planRefreshing}
								aria-label={t('ewaCompanion.planRefreshAria')}
								onClick={() => onRefreshPlan()}
							>
								<ArrowPathIcon
									className={cn(
										'size-3.5',
										planRefreshing && !reducedMotion && 'animate-spin'
									)}
									aria-hidden
								/>
							</button>
						</div>
						<div
							className="h-1.5 overflow-hidden rounded-full bg-(--desktop-surface-soft)/50"
							role="progressbar"
							aria-valuenow={planDisplayProgress}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={t('ewaCompanion.planProgressBarAria', {
								percent: planDisplayProgress,
							})}
						>
							<div
								className={cn(
									'h-full rounded-full bg-(--companion-aura)',
									'transition-[width] duration-300 motion-reduce:transition-none'
								)}
								style={{ width: `${planDisplayProgress}%` }}
							/>
						</div>
						<div className="space-y-0.5">
							<p className="text-[12px] font-medium leading-snug text-(--desktop-text-secondary)">
								{activePlanBundle.plan.title}
							</p>
						</div>
						{planGoalsSorted.length > 0 ? (
							<div className="space-y-1">
								<p className="text-[10px] font-medium uppercase tracking-wide text-(--companion-text-soft)">
									{t('ewaCompanion.planGoalsSection')}
								</p>
								<ul className="space-y-1">
									{planGoalsSorted.map((goal) => {
										const goalPct = resolveCompanionPlanGoalProgress(
											goal,
											activePlanBundle?.tasks ?? []
										);
										return (
											<li
												key={`plan-goal-${goal.id}`}
												className="rounded-md bg-(--desktop-surface-soft)/25 px-1.5 py-1"
											>
												<div className="flex items-center justify-between gap-2">
													<span className="min-w-0 flex-1 text-[11px] leading-snug text-(--desktop-text-secondary)">
														{goal.title}
													</span>
													<span className="shrink-0 text-[10px] tabular-nums text-(--companion-text-soft)">
														{t('ewaCompanion.planProgress', {
															percent: goalPct,
														})}
													</span>
												</div>
												<div className="mt-1 h-1 overflow-hidden rounded-full bg-(--desktop-surface-soft)/60">
													<div
														className="h-full rounded-full bg-(--companion-aura)"
														style={{ width: `${goalPct}%` }}
													/>
												</div>
											</li>
										);
									})}
								</ul>
							</div>
						) : null}
						{planTaskPartition.open.length > 0 ? (
							<div className="space-y-1">
								<p className="text-[10px] font-medium uppercase tracking-wide text-(--companion-text-soft)">
									{t('ewaCompanion.planOpenTasksSection')}
								</p>
								<ul className="max-h-[min(28vh,9rem)] space-y-1 overflow-y-auto overscroll-y-contain">
									{planTaskPartition.open.map((task) => {
										const busy = completingPlanTaskId === task.id || pending;
										const overdue = isCompanionPlanTaskOverdue(task);
										const due = parseCompanionPlanDueDate(task.due_date);
										return (
											<li
												key={`plan-open-${task.id}`}
												className="flex items-start gap-1.5"
											>
												<button
													type="button"
													className={cn(
														'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center',
														'rounded border border-(--companion-divider)',
														'bg-(--desktop-surface-soft)/40 text-(--companion-text-soft)',
														DESKTOP_CHROME_FOCUS_VISIBLE,
														busy && 'cursor-wait opacity-60'
													)}
													disabled={busy}
													aria-label={t('ewaCompanion.planCompleteTaskAria')}
													onClick={() => onCompleteTask(task.id)}
												>
													<span className="sr-only">
														{t('ewaCompanion.planCompleteTaskAria')}
													</span>
												</button>
												<div className="min-w-0 flex-1">
													<span className="text-[11px] leading-snug text-(--desktop-text-secondary)">
														{task.title}
													</span>
													{overdue ? (
														<span className="ml-1 inline-flex rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-400/40">
															{t('ewaCompanion.planOverdueBadge')}
														</span>
													) : due ? (
														<span className="mt-0.5 block text-[9px] text-(--companion-text-soft)">
															{t('ewaCompanion.planDueDate', {
																date: due.toLocaleDateString(
																	i18n.language.startsWith('ru')
																		? 'ru-RU'
																		: 'en-US'
																),
															})}
														</span>
													) : null}
												</div>
											</li>
										);
									})}
								</ul>
							</div>
						) : null}
						{planTaskPartition.done.length > 0 ? (
							<details className="group/done">
								<summary
									className={cn(
										'flex cursor-pointer list-none items-center gap-1',
										'text-[10px] font-medium text-(--companion-text-soft)',
										'[&::-webkit-details-marker]:hidden'
									)}
								>
									<ChevronDownIcon
										className={cn(
											'size-3 shrink-0 transition-transform',
											'group-open/done:rotate-180'
										)}
										aria-hidden
									/>
									{t('ewaCompanion.planDoneTasksSection')} (
									{planTaskPartition.done.length})
								</summary>
								<ul className="mt-1 space-y-0.5 pl-1">
									{planTaskPartition.done.map((task) => (
										<li
											key={`plan-done-${task.id}`}
											className="flex items-start gap-1 text-[11px] leading-snug text-(--companion-text-soft)"
										>
											<CheckCircleIcon
												className="mt-0.5 size-3.5 shrink-0 text-emerald-400/80"
												aria-hidden
											/>
											<span className="line-through opacity-80">
												{task.title}
											</span>
										</li>
									))}
								</ul>
							</details>
						) : null}
						{planFsmStatus === 'finish' ? (
							<div className="space-y-1.5 rounded-md border border-(--companion-divider)/60 bg-(--desktop-surface-soft)/20 px-2 py-1.5">
								<p className="text-[11px] leading-snug text-(--desktop-text-secondary)">
									{t('ewaCompanion.planFinishedHint')}
								</p>
								<button
									type="button"
									className={cn(
										'inline-flex w-full items-center justify-center rounded-md px-2 py-1',
										'text-[11px] font-medium text-(--desktop-text-primary)',
										'border border-(--companion-divider) bg-(--desktop-surface-soft)/50',
										DESKTOP_CHROME_FOCUS_VISIBLE,
										(archivingPlan || pending) && 'cursor-wait opacity-60'
									)}
									disabled={archivingPlan || pending}
									onClick={() => onArchivePlan()}
								>
									{t('ewaCompanion.planArchiveAction')}
								</button>
							</div>
						) : null}
						{planTaskPartition.open.length === 0 &&
						planTaskPartition.done.length > 0 &&
						planFsmStatus !== 'finish' ? (
							<p className="text-[10px] leading-snug text-(--companion-text-soft)">
								{t('ewaCompanion.planAllTasksDoneHint')}
							</p>
						) : null}
						{planRefreshing ? (
							<p className="text-[10px] text-(--companion-text-soft)">…</p>
						) : null}
					</div>
				</CompanionLeftRailSection>
			) : (
				<CompanionGlassCard
					className={cn(
						'px-2.5 py-2',
						'text-[12px] font-medium leading-snug text-(--companion-text-soft)'
					)}
				>
					<EwaIcon
						name="icon-ewa-analytics"
						size="sm"
						tone="muted"
						className="mb-1 opacity-70"
					/>
					{t('ewaCompanion.planStripPlaceholder')}
				</CompanionGlassCard>
			)}
		</div>
	);
}
