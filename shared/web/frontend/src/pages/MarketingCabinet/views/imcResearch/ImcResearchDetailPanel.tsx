/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * IMC Research detail panel: status, cancel/rerun/delete, meta, result markdown,
 * structured JSON, and project RAG promote/toggle actions.
 *
 * Invariants:
 * - Delete action visible only when isProjectLead.
 *
 * Related:
 * - ImcResearchView.tsx
 * - ImcResearchResultMarkdown
 */

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowDownTrayIcon,
	ArrowLeftIcon,
	ArrowPathIcon,
	ClipboardDocumentIcon,
	PlayIcon,
	StopCircleIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppErrorState,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../../Desktop/components/DesktopAppChrome';
import { ImcResearchResultMarkdown } from '../../components/ImcResearchResultMarkdown';
import { SectionPanel } from '../../components/SectionPanel';
import { statusBadgeClass } from './imcResearchHelpers';
import type { ImcResearchController } from './useImcResearchController';

export function ImcResearchDetailPanel({ c }: { c: ImcResearchController }) {
	return (
		<SectionPanel
			title={c.t('imcView.detailTitle')}
			description={c.t('imcView.detailDescription')}
			className="min-w-0"
			actions={
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="gap-1"
					onClick={c.onClearResearchSelection}
				>
					<ArrowLeftIcon
						className="h-4 w-4"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
					{c.t('imcView.backToForm')}
				</DesktopAppButton>
			}
		>
			{c.detailError ? (
				<DesktopAppErrorState
					message={c.detailError}
					actionLabel={c.t('imcView.refreshList')}
					onAction={() => void c.detailQuery.refetch()}
				/>
			) : c.detailQuery.isLoading ? (
				<div
					className="flex flex-col items-center justify-center gap-2 py-14"
					role="status"
					aria-live="polite"
				>
					<ArrowPathIcon
						className="h-8 w-8 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-(--desktop-text-dim)"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</div>
			) : (
				<div className="flex flex-col gap-5">
					<div className="flex flex-wrap items-center gap-3">
						<span
							className={cn(
								'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
								statusBadgeClass(c.activeStatus ?? '')
							)}
						>
							{c.t(`imcView.runStatus.${c.activeStatus ?? 'pending'}`, {
								defaultValue: c.activeStatus ?? '—',
							})}
						</span>
						{typeof c.statusQuery.data?.progress === 'number' &&
						(c.activeStatus === 'running' || c.activeStatus === 'pending') ? (
							<span className={DESKTOP_TYPOGRAPHY.meta}>
								{Math.round(c.statusQuery.data.progress)}%
							</span>
						) : null}
						{c.statusQuery.data?.progress_message ? (
							<span className={DESKTOP_TYPOGRAPHY.meta}>
								{c.statusQuery.data.progress_message}
							</span>
						) : null}
					</div>
					{c.canCancel ? (
						<div className="mt-1">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className="gap-1"
								disabled={c.cancelMutation.isPending}
								onClick={c.handleCancel}
							>
								{c.cancelMutation.isPending ? (
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								) : (
									<StopCircleIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
								{c.t('imcView.cancelRun')}
							</DesktopAppButton>
						</div>
					) : null}
					{c.canRerun ? (
						<div className="mt-1">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className="gap-1"
								disabled={c.rerunMutation.isPending}
								onClick={c.handleRerun}
							>
								{c.rerunMutation.isPending ? (
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								) : (
									<PlayIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
								{c.t('imcView.rerunAction')}
							</DesktopAppButton>
						</div>
					) : null}
					{c.isProjectLead && c.focusedEntityId ? (
						<div className="mt-1">
							<DesktopAppButton
								type="button"
								variant="danger"
								size="sm"
								className="gap-1"
								disabled={c.deleteMutation.isPending}
								onClick={() => {
									if (c.focusedEntityId) {
										c.handleDeleteResearch(c.focusedEntityId);
									}
								}}
							>
								{c.deleteMutation.isPending ? (
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								) : (
									<TrashIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
								{c.t('imcView.deleteResearch')}
							</DesktopAppButton>
						</div>
					) : null}
					{c.detailQuery.data ? (
						<div
							className={cn(
								'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-3.5 sm:p-4'
							)}
						>
							<h4
								className={cn(
									DESKTOP_APP_STYLE_CONTRACT.helperText,
									'mb-2 font-semibold uppercase tracking-wider'
								)}
							>
								{c.t('imcView.metaHeading')}
							</h4>
							<dl className="grid gap-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
								<dt className="text-(--desktop-text-muted)">
									{c.t('imcView.metaCreated')}
								</dt>
								<dd className="min-w-0 text-(--desktop-text-primary)">
									{c.detailQuery.data.created_at.replace('T', ' ').slice(0, 19)}
								</dd>
								{c.detailQuery.data.started_by_label ? (
									<>
										<dt className="text-(--desktop-text-muted)">
											{c.t('imcView.startedBy')}
										</dt>
										<dd className="min-w-0 text-(--desktop-text-primary)">
											{c.detailQuery.data.started_by_label}
										</dd>
									</>
								) : null}
								<dt className="text-(--desktop-text-muted)">
									{c.t('imcView.metaUgsRequest')}
								</dt>
								<dd className="flex min-w-0 flex-wrap items-center gap-2">
									<code className="text-xs break-all text-(--desktop-text-secondary)">
										{c.detailQuery.data.ugs_request_id}
									</code>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="shrink-0 gap-1"
										onClick={() => void c.handleCopyUgsRequestId()}
									>
										<ClipboardDocumentIcon
											className="h-3 w-3"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{c.t('imcView.metaCopyUgs')}
									</DesktopAppButton>
								</dd>
								{c.inputPayloadRecord?.imc_prompt_version != null &&
								String(c.inputPayloadRecord.imc_prompt_version).trim() !==
									'' ? (
									<>
										<dt className="text-(--desktop-text-muted)">
											{c.t('imcView.metaPromptVersion')}
										</dt>
										<dd className="text-(--desktop-text-primary)">
											{String(c.inputPayloadRecord.imc_prompt_version)}
										</dd>
									</>
								) : null}
							</dl>
							{c.inputPayloadRecord ? (
								<div className="mt-3 space-y-1.5">
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										className="gap-1"
										onClick={c.handleApplyPayloadToForm}
									>
										<ArrowLeftIcon
											className="h-3.5 w-3.5 rotate-180"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{c.t('imcView.metaApplyToForm')}
									</DesktopAppButton>
									<p className={DESKTOP_TYPOGRAPHY.meta}>
										{c.t('imcView.metaApplyToFormHint')}
									</p>
								</div>
							) : null}
						</div>
					) : null}
					{c.detailQuery.data?.result_text ? (
						<div className="space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
									<h4
										className={cn(
											DESKTOP_APP_STYLE_CONTRACT.helperText,
											'font-semibold uppercase tracking-wider'
										)}
									>
										{c.t('imcView.resultHeading')}
									</h4>
									<span
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'text-(--desktop-text-dim)'
										)}
									>
										{c.t('imcView.resultTextStats', {
											chars: c.resultBodyStats.chars.toLocaleString(
												c.statLocale
											),
											lines: c.resultBodyStats.lines.toLocaleString(
												c.statLocale
											),
										})}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="gap-1"
										onClick={() => void c.handleCopyResult()}
									>
										<ClipboardDocumentIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{c.copiedPulse
											? c.t('imcView.copied')
											: c.t('imcView.copyResult')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="gap-1"
										onClick={c.handleDownloadMarkdown}
									>
										<ArrowDownTrayIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{c.t('imcView.downloadMarkdown')}
									</DesktopAppButton>
									{c.canMutateProjectRag ? (
										<div className="contents">
											{!c.imcLinkedRagRow ? (
												<DesktopAppButton
													type="button"
													variant="neutral"
													size="sm"
													className="gap-1"
													disabled={c.postImcToRagMutation.isPending}
													onClick={c.handlePromoteImcToRag}
												>
													{c.postImcToRagMutation.isPending ? (
														<ArrowPathIcon
															className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													) : null}
													{c.t('imcView.addToProjectRag')}
												</DesktopAppButton>
											) : c.imcLinkedRagRow.marketing_rag_included ? (
												<DesktopAppButton
													type="button"
													variant="neutral"
													size="sm"
													className="gap-1"
													disabled={c.patchRagFromImcMutation.isPending}
													onClick={c.handleToggleImcRagLinked}
												>
													{c.patchRagFromImcMutation.isPending ? (
														<ArrowPathIcon
															className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													) : null}
													{c.t('imcView.excludeFromProjectRag')}
												</DesktopAppButton>
											) : (
												<DesktopAppButton
													type="button"
													variant="neutral"
													size="sm"
													className="gap-1"
													disabled={c.patchRagFromImcMutation.isPending}
													onClick={c.handleToggleImcRagLinked}
												>
													{c.patchRagFromImcMutation.isPending ? (
														<ArrowPathIcon
															className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													) : null}
													{c.t('imcView.includeInProjectRag')}
												</DesktopAppButton>
											)}
										</div>
									) : null}
								</div>
							</div>
							<article
								className="max-h-[min(60vh,32rem)] scroll-py-4 overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-4 sm:p-5"
								aria-label={c.t('imcView.resultHeading')}
							>
								<ImcResearchResultMarkdown
									markdown={c.detailQuery.data.result_text}
								/>
							</article>
						</div>
					) : null}
					{c.structuredJson ? (
						<div className="space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<h4
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.helperText,
										'font-semibold uppercase tracking-wider'
									)}
								>
									{c.t('imcView.structuredHeading')}
								</h4>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className="gap-1"
									onClick={c.handleDownloadStructuredJson}
								>
									<ArrowDownTrayIcon
										className="h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{c.t('imcView.structuredDownloadJson')}
								</DesktopAppButton>
							</div>
							<pre className="max-h-[min(40vh,24rem)] overflow-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3.5 font-mono text-[11px] leading-relaxed text-(--desktop-text-secondary) sm:p-4 sm:text-xs">
								{c.structuredJson}
							</pre>
						</div>
					) : null}
				</div>
			)}
		</SectionPanel>
	);
}
