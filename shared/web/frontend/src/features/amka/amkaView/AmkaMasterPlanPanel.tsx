/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Master plan details with skip toggles for sections, steps, and operations.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewRunDerived.ts
 */

import { useTranslation } from 'react-i18next';

import type { buildAmkaOperationReview } from '@/features/amka/amkaOperationReviewModel';
import {
	readPlanTaskOptionalString,
	readPlanTaskOptionalStringArray,
} from '@/features/amka/amkaViewUtils';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type { AmkaRun } from '@/services/amka/marketingCabinetAmkaBridge';
import { cn } from '@/utils/cn';

type OperationReview = ReturnType<typeof buildAmkaOperationReview>;

type PlannedOperation = NonNullable<
	NonNullable<AmkaRun['master_plan']>[number]['operations']
>[number];

type AmkaMasterPlanPanelProps = {
	selectedRun: AmkaRun;
	ensemblePlanTaskCount: number;
	plannedOperations: PlannedOperation[];
	plannedDestructiveCount: number;
	operationReview: OperationReview;
	skipSectionKeys: Record<string, boolean>;
	onSkipSectionKeysChange: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	skipOperationKeys: Record<string, boolean>;
	onSkipOperationKeysChange: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	skipStepIds: Record<string, boolean>;
	onSkipStepIdsChange: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	busy: boolean;
};

export function AmkaMasterPlanPanel({
	selectedRun,
	ensemblePlanTaskCount,
	plannedOperations,
	plannedDestructiveCount,
	operationReview,
	skipSectionKeys,
	onSkipSectionKeysChange,
	skipOperationKeys,
	onSkipOperationKeysChange,
	skipStepIds,
	onSkipStepIdsChange,
	busy,
}: AmkaMasterPlanPanelProps) {
	const { t } = useTranslation('marketing');
	const masterPlan = selectedRun.master_plan ?? [];

	if (masterPlan.length === 0) {
		return null;
	}

	const handleSkipAllDestructive = () => {
		const next: Record<string, boolean> = { ...skipOperationKeys };
		for (const task of masterPlan) {
			for (const op of task.operations ?? []) {
				const k = op.operation_key?.trim();
				if (k && op.destructive) {
					next[k] = true;
				}
			}
		}
		onSkipOperationKeysChange(next);
	};

	return (
		<details
			className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-3"
			open={
				selectedRun.status === 'awaiting_approval' ||
				selectedRun.status === 'awaiting_step_approval'
			}
		>
			<summary
				className={cn(
					'cursor-pointer list-none text-sm font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden'
				)}
				aria-label={t('amkaView.spoilerMasterPlanAria')}
			>
				{t('amkaView.spoilerMasterPlanSummary')}
			</summary>
			<div className="mt-3 space-y-3 border-t border-(--desktop-border-subtle) pt-3">
				<h4 className="sr-only">{t('amkaView.masterPlanTitle')}</h4>
				{ensemblePlanTaskCount > 0 ? (
					<p className="text-xs text-(--desktop-text-muted) wrap-pretty">
						{t('amkaView.masterPlanEnsembleCount', {
							count: ensemblePlanTaskCount,
						})}
					</p>
				) : null}
				{selectedRun.master_plan_summary ? (
					<p className="mt-1 text-sm text-(--desktop-text-secondary)">
						{selectedRun.master_plan_summary}
					</p>
				) : null}
				{selectedRun.plan_source ? (
					<p className="mt-1 text-xs text-(--desktop-text-muted)">
						<span className="mr-1.5 inline-flex rounded-full bg-(--desktop-surface-panel) px-2 py-0.5 font-medium text-(--desktop-text-secondary) ring-1 ring-(--desktop-border-subtle)">
							{selectedRun.plan_source === 'llm'
								? t('amkaView.planSourceLlm')
								: t('amkaView.planSourceHeuristic')}
						</span>
						<span className="text-(--desktop-text-muted)">
							{t('amkaView.planSourceLabel')}
						</span>
						{selectedRun.plan_llm_status &&
						selectedRun.plan_llm_status !== 'ok' ? (
							<span className="mt-1 block text-(--desktop-text-muted)">
								{t('amkaView.planLlmStatusLine', {
									status: t(
										`amkaView.planLlmStatus.${selectedRun.plan_llm_status}`,
										{
											defaultValue: selectedRun.plan_llm_status,
										}
									),
								})}
							</span>
						) : null}
						{selectedRun.plan_llm_status &&
						['parse_error', 'empty', 'error'].includes(
							selectedRun.plan_llm_status
						) ? (
							<span className="mt-2 block text-xs leading-relaxed text-(--desktop-text-secondary) wrap-pretty">
								{t('amkaView.planQualityHint')}
							</span>
						) : null}
						{selectedRun.plan_structure_errors &&
						selectedRun.plan_structure_errors.length > 0 ? (
							<span className="mt-1 block font-mono text-xs text-(--desktop-text-muted) wrap-break-word">
								{t('amkaView.planStructureErrorsLine', {
									value: selectedRun.plan_structure_errors
										.slice(0, 6)
										.join('; '),
								})}
							</span>
						) : null}
					</p>
				) : null}
				{selectedRun.audit_llm_stats &&
				typeof selectedRun.audit_llm_stats.total === 'number' &&
				selectedRun.audit_llm_stats.total > 0 ? (
					<p className="mt-1 text-xs text-(--desktop-text-muted)">
						{t('amkaView.auditLlmStatsLine', {
							ok: selectedRun.audit_llm_stats.ok ?? 0,
							fallback: selectedRun.audit_llm_stats.fallback ?? 0,
							total: selectedRun.audit_llm_stats.total ?? 0,
						})}
					</p>
				) : null}
				{selectedRun.status === 'awaiting_approval' && masterPlan.length > 0 ? (
					<p className="mt-2 text-xs text-(--desktop-text-secondary)">
						{t('amkaView.skipSectionsHint')}
					</p>
				) : null}
				{selectedRun.status === 'awaiting_approval' &&
				plannedOperations.length > 0 ? (
					<div className="mt-2 space-y-2">
						<p className="text-xs text-(--desktop-text-secondary)">
							{t('amkaView.skipOperationsHint')}
						</p>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="text-xs"
							disabled={busy}
							onClick={handleSkipAllDestructive}
						>
							{t('amkaView.skipAllDestructive')}
						</DesktopAppButton>
					</div>
				) : null}
				{plannedOperations.length > 0 ? (
					<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2">
							<div className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
								{t('amkaView.pendingOperationsTitle')}
							</div>
							<div className="mt-1 text-lg font-semibold text-(--desktop-text-primary)">
								{plannedOperations.length}
							</div>
						</div>
						<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2">
							<div className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
								{t('amkaView.pendingDestructiveTitle')}
							</div>
							<div className="mt-1 text-lg font-semibold text-(--desktop-text-primary)">
								{plannedDestructiveCount}
							</div>
						</div>
					</div>
				) : null}
				<ul className="mt-3 space-y-2 text-sm text-(--desktop-text-secondary)">
					{masterPlan.map((task) => {
						const reviewStep = operationReview.items.find(
							(item) =>
								item.stepTitle === task.title &&
								item.sectionKey === task.section_key
						);
						const executionMode = readPlanTaskOptionalString(
							task,
							'execution_mode'
						);
						const ensembleTemplateHint = readPlanTaskOptionalString(
							task,
							'ensemble_template_hint'
						);
						const ensembleHeroIds = readPlanTaskOptionalStringArray(
							task,
							'ensemble_hero_ids'
						);
						return (
							<li
								key={task.step_key}
								className="rounded-lg border border-(--desktop-border-subtle) px-3 py-2"
							>
								{selectedRun.status === 'awaiting_approval' ? (
									<div className="mb-2 flex flex-col gap-1.5">
										<label className="flex cursor-pointer items-start gap-2 text-xs text-(--desktop-text-secondary)">
											<input
												type="checkbox"
												className="mt-0.5 rounded border-(--desktop-border-subtle)"
												checked={Boolean(skipSectionKeys[task.section_key])}
												onChange={(e) => {
													onSkipSectionKeysChange((prev) => ({
														...prev,
														[task.section_key]: e.target.checked,
													}));
												}}
											/>
											<span>{t('amkaView.skipSectionToggle')}</span>
										</label>
										{reviewStep?.stepId ? (
											<label className="flex cursor-pointer items-start gap-2 text-xs text-(--desktop-text-secondary)">
												<input
													type="checkbox"
													className="mt-0.5 rounded border-(--desktop-border-subtle)"
													checked={Boolean(skipStepIds[reviewStep.stepId])}
													onChange={(e) => {
														onSkipStepIdsChange((prev) => ({
															...prev,
															[reviewStep.stepId as string]: e.target.checked,
														}));
													}}
												/>
												<span>{t('amkaView.skipSingleStepToggle')}</span>
											</label>
										) : null}
									</div>
								) : null}
								<div className="flex flex-wrap items-center gap-2">
									<div className="font-medium text-(--desktop-text-primary)">
										{task.title}
									</div>
									{executionMode ? (
										<span
											className={cn(
												'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
												executionMode === 'desktop_ensemble'
													? 'bg-violet-500/15 text-violet-100 ring-violet-500/30'
													: 'bg-(--desktop-surface-panel) text-(--desktop-text-muted) ring-(--desktop-border-subtle)'
											)}
											title={executionMode}
										>
											{t(`amkaView.executionModeShort.${executionMode}`, {
												defaultValue: executionMode,
											})}
										</span>
									) : null}
								</div>
								{task.rationale ? (
									<div className="mt-1">{task.rationale}</div>
								) : null}
								{executionMode === 'desktop_ensemble' ? (
									<div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-(--desktop-text-muted)">
										{ensembleTemplateHint ? (
											<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 font-mono">
												{ensembleTemplateHint}
											</span>
										) : null}
										{ensembleHeroIds.length > 0 ? (
											<span>
												{t('amkaView.masterPlanEnsembleHeroes', {
													value: ensembleHeroIds.join(', '),
												})}
											</span>
										) : null}
									</div>
								) : null}
								{Array.isArray(task.operations) &&
								task.operations.length > 0 ? (
									<div className="mt-2 space-y-2">
										<div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
											{t('amkaView.pendingOperationsTitle')}
										</div>
										<ul className="space-y-1.5 text-xs text-(--desktop-text-secondary)">
											{task.operations.map((operation, index) => {
												const opKey = operation.operation_key?.trim() ?? '';
												return (
													<li
														key={
															opKey ||
															`${task.step_key}-${operation.kind}-${operation.entity_id || operation.title || index}`
														}
														className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-2.5 py-2"
													>
														{selectedRun.status === 'awaiting_approval' &&
														opKey ? (
															<label className="mb-2 flex cursor-pointer items-start gap-2 text-xs text-(--desktop-text-secondary)">
																<input
																	type="checkbox"
																	className="mt-0.5 rounded border-(--desktop-border-subtle)"
																	checked={Boolean(skipOperationKeys[opKey])}
																	onChange={(e) => {
																		onSkipOperationKeysChange((prev) => ({
																			...prev,
																			[opKey]: e.target.checked,
																		}));
																	}}
																/>
																<span>{t('amkaView.skipOperationToggle')}</span>
															</label>
														) : null}
														<div className="flex flex-wrap items-center gap-2">
															<span className="font-medium text-(--desktop-text-primary)">
																{operation.title ||
																	operation.expected_effect ||
																	operation.kind}
															</span>
															{operation.destructive ? (
																<span className="inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-100 ring-1 ring-inset ring-red-500/30">
																	{t('amkaView.destructiveBadge')}
																</span>
															) : null}
														</div>
														<div className="mt-1 text-(--desktop-text-secondary)">
															{operation.reason ||
																operation.expected_effect ||
																t('amkaView.noSummary')}
														</div>
														{Array.isArray(operation.source_refs) &&
														operation.source_refs.length > 0 ? (
															<div className="mt-1 text-(--desktop-text-muted)">
																{t('amkaView.operationSourcesLabel')}:{' '}
																{operation.source_refs
																	.slice(0, 3)
																	.map((ref) => ref.title || ref.id)
																	.join(', ')}
															</div>
														) : null}
													</li>
												);
											})}
										</ul>
									</div>
								) : null}
							</li>
						);
					})}
				</ul>
			</div>
		</details>
	);
}
