/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-item batch progress grid with before/after preview and accept/reject.
 *
 * Invariants:
 * - Localized status/decision/progress labels; UUID only under SupportDetails.
 * - Accept/reject shown only when `realtorBatchLineAwaitingDecision` is true.
 *
 * Related:
 * - mediaBatchMapper.ts
 * - helpers.ts
 */

import { ContentThumbnail } from '@/components/UnifiedContent/components/ContentThumbnail/ContentThumbnail';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type { ReactElement } from 'react';
import { SupportDetailsPanel } from '../components/SupportDetailsPanel';
import { ProfessionalWorldsStatusBanner } from '../layout';
import {
	realtorBatchLineAwaitingDecision,
	type ProfessionalBatchItemProgressRow,
} from '../mediaBatchMapper';
import type { RealtorMediaBatchDetail } from '../types';
import { latestProgressSignal, translateMediaValue } from './helpers';
import type { ProfessionalMediaWorkbenchModel } from './useProfessionalMediaWorkbench';

type BatchProgressProps = {
	readonly model: Pick<
		ProfessionalMediaWorkbenchModel,
		| 't'
		| 'activeBatchId'
		| 'batchDetail'
		| 'sseRows'
		| 'enhancementById'
		| 'decideLine'
		| 'openPreview'
	>;
};

export function MediaWorkbenchBatchProgress({
	model,
}: BatchProgressProps): ReactElement | null {
	const {
		t,
		activeBatchId,
		batchDetail,
		sseRows,
		enhancementById,
		decideLine,
		openPreview,
	} = model;

	if (!activeBatchId || !batchDetail?.items?.length) {
		return null;
	}

	return (
		<div className="grid gap-2">
			<DesktopAppSectionLabel>
				{t('mediaWorkbench.progressGrid')}
			</DesktopAppSectionLabel>
			<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
				{batchDetail.items.map(
					(
						item: RealtorMediaBatchDetail['items'][number],
						itemIndex: number
					) => {
						const progressSignal = latestProgressSignal(
							sseRows[item.id] as ProfessionalBatchItemProgressRow | undefined
						);
						const job = item.enhancement_job_id
							? enhancementById[item.enhancement_job_id]
							: null;
						const jobStatusLabel = translateMediaValue(
							t,
							'jobStatuses',
							job?.status
						);
						const reviewDecisionLabel = item.review_decision
							? translateMediaValue(t, 'reviewDecisions', item.review_decision)
							: null;
						const progressSignalLabel = progressSignal
							? translateMediaValue(t, 'progressSignals', progressSignal)
							: null;
						return (
							<div
								key={item.id}
								className={cn(
									'rounded-(--desktop-radius-xs) border p-3 text-xs',
									item.review_decision === 'rejected'
										? 'border-red-700/35'
										: 'border-(--desktop-border-soft)'
								)}
							>
								<strong className="block text-[11px] uppercase tracking-wide text-(--desktop-text-dim)">
									{t('mediaWorkbench.itemFrame', {
										index: itemIndex + 1,
									})}
								</strong>
								<div className="mt-2 space-y-1 text-(--desktop-text-secondary)">
									<div className="grid grid-cols-2 gap-2">
										<div className="grid gap-1">
											<span className="text-[10px] uppercase tracking-wide text-(--desktop-text-dim)">
												{t('mediaWorkbench.sourcePreview')}
											</span>
											<div className="size-20 overflow-hidden rounded-(--desktop-radius-xxs) border border-(--desktop-border-soft)">
												<button
													type="button"
													className="size-full"
													onClick={() => {
														openPreview(
															item.source_content_id,
															t('mediaWorkbench.sourcePreview')
														);
													}}
												>
													<ContentThumbnail
														className="size-full object-cover"
														contentId={item.source_content_id}
														loadingClassName="size-full"
														alt={t('mediaWorkbench.sourcePreview')}
													/>
												</button>
											</div>
										</div>
										<div className="grid gap-1">
											<span className="text-[10px] uppercase tracking-wide text-(--desktop-text-dim)">
												{t('mediaWorkbench.resultPreview')}
											</span>
											<div className="size-20 overflow-hidden rounded-(--desktop-radius-xxs) border border-(--desktop-border-soft)">
												{job?.output_content_id ? (
													<button
														type="button"
														className="size-full"
														onClick={() => {
															openPreview(
																job.output_content_id ?? '',
																t('mediaWorkbench.resultPreview')
															);
														}}
													>
														<ContentThumbnail
															className="size-full object-cover"
															contentId={job.output_content_id}
															loadingClassName="size-full"
															alt={t('mediaWorkbench.resultPreview')}
														/>
													</button>
												) : (
													<div className="flex size-full items-center justify-center px-1 text-center text-[10px] text-(--desktop-text-muted)">
														{t('mediaWorkbench.noResultPreview')}
													</div>
												)}
											</div>
										</div>
									</div>
									<div>
										{t('mediaWorkbench.processingStatus', {
											status: jobStatusLabel,
										})}
									</div>
									<p>
										{job?.output_content_id
											? t('mediaWorkbench.outputReady')
											: t('mediaWorkbench.outputWaiting')}
									</p>
									{progressSignalLabel ? (
										<p>
											{t('mediaWorkbench.progressSignalLabel', {
												signal: progressSignalLabel,
											})}
										</p>
									) : null}
									{item.review_decision ? (
										<p>
											{t('mediaWorkbench.reviewDecisionLabel', {
												decision: reviewDecisionLabel,
											})}
										</p>
									) : null}
									<SupportDetailsPanel className="text-(--desktop-text-muted)">
										<div className="grid gap-1 font-mono text-[10px]">
											<span>
												{t('mediaWorkbench.sourceIdLabel', {
													id: item.source_content_id,
												})}
											</span>
											<span>
												{t('mediaWorkbench.resultIdLabel', {
													id: job?.output_content_id ?? '—',
												})}
											</span>
										</div>
									</SupportDetailsPanel>
									{sseRows[item.id]?.last_error ? (
										<ProfessionalWorldsStatusBanner
											kind="error"
											role="alert"
											className="mt-1"
										>
											{sseRows[item.id]?.last_error}
										</ProfessionalWorldsStatusBanner>
									) : null}
									{realtorBatchLineAwaitingDecision(item, job) ? (
										<div className="mt-3 flex flex-wrap gap-2">
											<DesktopAppButton
												variant="ghost"
												className="px-2! py-1! text-[11px]"
												onClick={() => void decideLine(item.id, 'accepted')}
											>
												{t('mediaWorkbench.accept')}
											</DesktopAppButton>
											<DesktopAppButton
												variant="ghost"
												className="px-2! py-1! text-[11px]"
												onClick={() => void decideLine(item.id, 'rejected')}
											>
												{t('mediaWorkbench.reject')}
											</DesktopAppButton>
										</div>
									) : null}
								</div>
							</div>
						);
					}
				)}
			</div>
		</div>
	);
}
