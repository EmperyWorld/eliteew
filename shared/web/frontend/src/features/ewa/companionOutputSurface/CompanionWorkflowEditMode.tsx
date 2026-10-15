/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * List and manage personal companion action chains.
 *
 * Invariants:
 * - Stale workflow rows are refreshed on 404 instead of surfacing unhandled promises.
 * - Loading/empty states are polite status updates; action failures are assertive alerts.
 *
 * Related:
 * - src/services/ewa/companionUserWorkflowsApi.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import { CompanionWorkflowObservationSettings } from '@/features/ewa/companionOutputSurface/CompanionWorkflowObservationSettings';
import { CompanionWorkflowRowMenu } from '@/features/ewa/companionOutputSurface/CompanionWorkflowRowMenu';
import {
	isCompanionUserWorkflowDagV2,
	mergeCompanionUserWorkflowRows,
	summarizeWorkflowSteps,
	triggerPatternsFromWorkflow,
	workflowGraphUnitCount,
} from '@/features/ewa/companionOutputSurface/companionUserWorkflowUi';
import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	deleteCompanionUserWorkflow,
	fetchCompanionUserWorkflowToolCatalog,
	isCompanionUserWorkflowNotFound,
	listCompanionUserWorkflows,
	setCompanionUserWorkflowEnabled,
	type CompanionUserWorkflow,
	type CompanionUserWorkflowToolCatalogEntry,
} from '@/services/ewa/companionUserWorkflowsApi';
import { mergeCompanionUserWorkflowToolCatalog } from '@/services/ewa/companionUserWorkflowToolCatalogFallback';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	initialWorkflow?: CompanionUserWorkflow;
	highlightWorkflowId?: string;
	principalId?: string;
	onBackToChat: () => void;
	onEditDagWorkflow: (workflowId: string) => void;
	onOpenDagBuilder: () => void;
	onDuplicateWorkflow: (workflowId: string, opts?: { dagV2?: boolean }) => void;
	onQuickStart?: (templateKey: string) => void;
};

export function CompanionWorkflowEditMode({
	initialWorkflow,
	highlightWorkflowId,
	principalId = '',
	onBackToChat,
	onEditDagWorkflow,
	onOpenDagBuilder,
	onDuplicateWorkflow,
	onQuickStart,
}: Props) {
	const { t, i18n } = useTranslation('marketing');
	const ru = i18n.language.startsWith('ru');
	const [optimisticWorkflow, setOptimisticWorkflow] =
		useState<CompanionUserWorkflow | null>(initialWorkflow ?? null);
	const [rows, setRows] = useState<CompanionUserWorkflow[]>(() =>
		initialWorkflow ? [initialWorkflow] : []
	);
	const [catalog, setCatalog] = useState<
		CompanionUserWorkflowToolCatalogEntry[]
	>(() => mergeCompanionUserWorkflowToolCatalog(null).catalog);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string>('all');

	const quickStartKeys = ['music', 'files', 'image', 'plan'] as const;

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const serverRows = await listCompanionUserWorkflows();
			setRows(mergeCompanionUserWorkflowRows(serverRows, optimisticWorkflow));
		} catch (err) {
			ewaCompanionDegradeDebug(
				'workflow_edit_reload',
				'workflow list reload failed',
				err
			);
			setRows(optimisticWorkflow ? [optimisticWorkflow] : []);
		} finally {
			setLoading(false);
		}
	}, [optimisticWorkflow]);

	useEffect(() => {
		if (!initialWorkflow?.id) return;
		setOptimisticWorkflow(initialWorkflow);
		setRows((prev) => mergeCompanionUserWorkflowRows(prev, initialWorkflow));
	}, [initialWorkflow]);

	useEffect(() => {
		void reload();
		void fetchCompanionUserWorkflowToolCatalog()
			.then((server) => {
				setCatalog(mergeCompanionUserWorkflowToolCatalog(server).catalog);
			})
			.catch((err) => {
				ewaCompanionDegradeDebug(
					'workflow_edit_tool_catalog',
					'tool catalog fetch failed; using client fallback',
					err
				);
				setCatalog(mergeCompanionUserWorkflowToolCatalog(null).catalog);
			});
	}, [reload]);

	const toggleEnabled = async (row: CompanionUserWorkflow) => {
		setBusyId(row.id);
		setActionError(null);
		try {
			const updated = await setCompanionUserWorkflowEnabled(
				row.id,
				!row.enabled
			);
			const nextOptimistic =
				optimisticWorkflow?.id === row.id ? updated : optimisticWorkflow;
			setOptimisticWorkflow(nextOptimistic);
			const serverRows = await listCompanionUserWorkflows();
			setRows(mergeCompanionUserWorkflowRows(serverRows, nextOptimistic));
		} catch (err) {
			await reload();
			setActionError(
				isCompanionUserWorkflowNotFound(err)
					? t('ewaCompanion.userWorkflowEditAlreadyGone')
					: t('ewaCompanion.userWorkflowEditActionFailed')
			);
		} finally {
			setBusyId(null);
		}
	};

	const remove = async (row: CompanionUserWorkflow) => {
		setBusyId(row.id);
		setActionError(null);
		try {
			await deleteCompanionUserWorkflow(row.id);
			const nextOptimistic =
				optimisticWorkflow?.id === row.id ? null : optimisticWorkflow;
			setOptimisticWorkflow(nextOptimistic);
			const serverRows = await listCompanionUserWorkflows();
			setRows(mergeCompanionUserWorkflowRows(serverRows, nextOptimistic));
		} catch (err) {
			await reload();
			setActionError(
				isCompanionUserWorkflowNotFound(err)
					? t('ewaCompanion.userWorkflowEditAlreadyGone')
					: t('ewaCompanion.userWorkflowEditActionFailed')
			);
		} finally {
			setBusyId(null);
		}
	};

	return (
		<CompanionSurfacePanel
			title={t('ewaCompanion.userWorkflowEditTitle')}
			subtitle={t('ewaCompanion.userWorkflowEditSubtitle', {
				count: rows.length,
			})}
			onBack={onBackToChat}
			backLabel={t('ewaCompanion.outputSurfaceBackToChat')}
			testId="ewa-companion-workflow-edit"
			footer={
				<div className="flex justify-end">
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={onOpenDagBuilder}
							data-testid="ewa-workflow-edit-new-visual"
						>
							{t('ewaCompanion.userWorkflowEditNewVisual')}
						</DesktopAppButton>
					</div>
				</div>
			}
		>
			{loading ? (
				<p
					className="text-[12px] text-(--companion-text-soft)"
					role="status"
					aria-live="polite"
				>
					{t('ewaCompanion.userWorkflowEditLoading')}
				</p>
			) : (
				<>
					{actionError ? (
						<div
							className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/90"
							role="alert"
							aria-live="assertive"
						>
							{actionError}
						</div>
					) : null}
					{rows.length > 0 ? (
						<div className="mb-2 flex flex-wrap gap-1.5">
							{(['all', 'enabled', 'disabled'] as const).map((filter) => (
								<button
									key={filter}
									type="button"
									className={cn(
										'rounded-full px-2 py-0.5 text-[10px] font-medium',
										categoryFilter === filter
											? 'bg-(--companion-aura)/15 text-(--companion-aura)'
											: 'bg-white/5 text-(--companion-text-soft)'
									)}
									onClick={() => setCategoryFilter(filter)}
								>
									{t(`ewaCompanion.userWorkflowFilter.${filter}`)}
								</button>
							))}
						</div>
					) : null}
					{rows.length === 0 ? (
						<div className="flex flex-col items-center gap-3 py-6 text-center">
							<p
								className="text-[12px] text-(--companion-text-soft)"
								role="status"
								aria-live="polite"
							>
								{t('ewaCompanion.userWorkflowEditEmpty')}
							</p>
							<div className="flex flex-wrap justify-center gap-2">
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={onOpenDagBuilder}
									data-testid="ewa-workflow-edit-empty-visual"
								>
									{t('ewaCompanion.userWorkflowEditEmptyVisualCta')}
								</DesktopAppButton>
							</div>
							<div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
								{quickStartKeys.map((key) => (
									<button
										key={key}
										type="button"
										className={cn(
											'rounded-xl border border-(--companion-divider)/80',
											'bg-(--desktop-surface-soft)/25 px-3 py-4 text-[12px] font-medium',
											'text-(--desktop-text-primary) hover:bg-(--companion-aura)/10'
										)}
										onClick={() => onQuickStart?.(key) ?? onOpenDagBuilder()}
									>
										{t(`ewaCompanion.userWorkflowQuickStart.${key}`)}
									</button>
								))}
							</div>
						</div>
					) : (
						<ul className="flex flex-col gap-2 pb-2">
							{rows
								.filter((row) => {
									if (categoryFilter === 'all') return true;
									if (categoryFilter === 'enabled') return row.enabled;
									return !row.enabled;
								})
								.map((row) => {
									const patterns = triggerPatternsFromWorkflow(row).join(', ');
									const stepSummary = summarizeWorkflowSteps(row, catalog, ru);
									const stepCount = workflowGraphUnitCount(
										row.definition_json as Record<string, unknown> | undefined
									);
									const isDagV2 = isCompanionUserWorkflowDagV2(row);
									const isLegacyReadOnly = !isDagV2;
									return (
										<li
											key={row.id}
											className={cn(
												'rounded-lg border border-(--companion-divider)/80',
												'bg-(--desktop-surface-soft)/20 px-3 py-2.5'
											)}
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<p className="text-[13px] font-medium text-(--desktop-text-primary)">
															{row.name}
														</p>
														<span
															className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-(--companion-text-soft)"
															data-testid={
																isDagV2
																	? 'ewa-workflow-schema-visual'
																	: 'ewa-workflow-schema-linear'
															}
														>
															{isDagV2
																? t('ewaCompanion.userWorkflowEditSchemaVisual')
																: t(
																		'ewaCompanion.userWorkflowEditSchemaLinear'
																	)}
														</span>
														{highlightWorkflowId === row.id ? (
															<span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-200">
																{t('ewaCompanion.userWorkflowEditJustSaved')}
															</span>
														) : null}
														<span
															className={cn(
																'rounded-full px-2 py-0.5 text-[10px] font-medium',
																row.enabled
																	? 'bg-emerald-500/15 text-emerald-200'
																	: 'bg-(--desktop-surface-soft)/60 text-(--companion-text-soft)'
															)}
														>
															{row.enabled
																? t('ewaCompanion.userWorkflowEditEnabled')
																: t('ewaCompanion.userWorkflowEditDisabled')}
														</span>
													</div>
													<p className="mt-1 text-[11px] text-(--companion-text-soft)">
														{t('ewaCompanion.userWorkflowEditTrigger', {
															phrase: patterns || '—',
														})}
													</p>
													<p className="mt-0.5 text-[11px] text-(--companion-aura)/90">
														{t('ewaCompanion.userWorkflowEditStepsSummary', {
															count: stepCount,
															summary: stepSummary,
														})}
													</p>
													{isLegacyReadOnly ? (
														<p className="mt-1 text-[11px] text-amber-100/85">
															{t('ewaCompanion.userWorkflowEditLegacyReadOnly')}
														</p>
													) : null}
												</div>
												<CompanionWorkflowRowMenu
													enabled={row.enabled}
													disabled={busyId === row.id}
													onEdit={
														isDagV2
															? () => onEditDagWorkflow(row.id)
															: undefined
													}
													onDuplicate={
														isDagV2
															? () =>
																	onDuplicateWorkflow(row.id, {
																		dagV2: true,
																	})
															: undefined
													}
													onToggleEnabled={() => void toggleEnabled(row)}
													onDelete={() => void remove(row)}
												/>
											</div>
										</li>
									);
								})}
						</ul>
					)}
					{principalId ? (
						<CompanionWorkflowObservationSettings
							principalId={principalId}
							className="mt-3"
						/>
					) : null}
				</>
			)}
		</CompanionSurfacePanel>
	);
}

export function workflowDagBuilderSurface(
	workflowId?: string,
	opts?: { duplicateFromId?: string; seedTriggerPhrase?: string }
): CompanionOutputSurfaceState {
	return {
		mode: 'workflow_dag_builder',
		payload: {
			...(workflowId ? { workflowId } : {}),
			...(opts?.duplicateFromId
				? { duplicateFromId: opts.duplicateFromId }
				: {}),
			...(opts?.seedTriggerPhrase?.trim()
				? { seedTriggerPhrase: opts.seedTriggerPhrase.trim() }
				: {}),
		},
	};
}
