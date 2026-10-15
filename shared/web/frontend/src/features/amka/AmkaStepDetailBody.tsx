/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detailed body for a single AMKA run step (audit, execute, links to cabinet deep links).
 * Surfaces execute evidence such as IMC type keys, child jobs, operation trail, and saved entities.
 *
 * Invariants:
 * - Copy uses marketing i18n; deep links use Marketing Cabinet navigation contract.
 *
 * Related:
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 * - src/features/amka/amkaViewUtils.ts
 */
import { useTranslation } from 'react-i18next';

import {
	CheckCircleIcon,
	ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

import { cn } from '@/utils/cn';

import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	buildMarketingCabinetDeepLinkForAmkaChildJob,
	buildMarketingCabinetDeepLinkForAmkaEntity,
	ImcResearchResultMarkdown,
	openDesktopApp,
	type AmkaRunStep,
	type MarketingCabinetDeepLinkState,
} from '@/services/amka/marketingCabinetAmkaBridge';

import {
	formatShortDate,
	formatAmkaEnsembleErrorForUi,
	readBooleanField,
	readErrorSummary,
	readNumberField,
	readObjectArray,
	readStringField,
	resolveAmkaStepEnsembleMeta,
	summarizeSnapshot,
	amkaStepStatusClass,
} from '@/features/amka/amkaViewUtils';
import { getDesktopAiHero } from '@/features/desktop-ai-chat/desktopAiHeroes';

export function AmkaStepDetailBody({
	step,
	onOpenAiStudio,
	selectedCompanyId,
	selectedProjectId,
}: {
	step: AmkaRunStep;
	onOpenAiStudio?: () => void;
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
}) {
	const { t } = useTranslation('marketing');
	const stepError = readErrorSummary(step.error_payload);
	const appliedCount = readNumberField(step.metrics_after, 'applied_count');
	const childJobs = readObjectArray(step.report_payload?.child_jobs);
	const imcSubset =
		step.report_payload?.imc_subset &&
		typeof step.report_payload.imc_subset === 'object'
			? (step.report_payload.imc_subset as Record<string, unknown>)
			: null;
	const imcTypeKey =
		readStringField(step.plan_payload, 'imc_type_key') ||
		readStringField(step.report_payload, 'type_key') ||
		readStringField(imcSubset, 'type_key') ||
		childJobs
			.map((job) => readStringField(job, 'type_key'))
			.find((value): value is string => Boolean(value));
	const ensembleMeta = resolveAmkaStepEnsembleMeta(step);
	const {
		isEnsembleStep,
		heroIds: ensembleHeroIds,
		template: ensembleTemplate,
		fallback: ensembleFallback,
		error: ensembleError,
		elapsedMs: ensembleElapsedMs,
	} = ensembleMeta;
	const stepFailure = readErrorSummary(step.error_payload);
	const showGenericStepFailure =
		step.status === 'failed' &&
		Boolean(stepFailure?.message) &&
		!isEnsembleStep;
	const operationTrail = readObjectArray(
		step.operation_trail?.length
			? step.operation_trail
			: step.report_payload?.operation_trail
	);

	const openCabinetDeepLink = (state: MarketingCabinetDeepLinkState | null) => {
		if (!state) return;
		openDesktopApp('MarketingCabinet', { marketingCabinetDeepLink: state });
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--desktop-border-subtle) pb-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="text-xs font-semibold text-(--desktop-text-secondary)">
						#{step.ordinal}
					</span>
					<span className="min-w-0 text-sm font-medium text-(--desktop-text-primary)">
						{step.title}
					</span>
				</div>
				<span
					className={cn(
						'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
						amkaStepStatusClass(step.status)
					)}
				>
					{t(`amkaView.stepStatus.${step.status}`)}
				</span>
			</div>
			{ensembleMeta.execMode && !isEnsembleStep ? (
				<div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-2.5 py-1 text-xs text-(--desktop-text-secondary)">
					<span>{t('amkaView.executionModeLabel')}</span>
					<code className="max-w-full truncate font-mono text-[11px] text-(--desktop-text-primary)">
						{ensembleMeta.execMode}
					</code>
				</div>
			) : null}
			{step.stage_kind === 'section_audit' &&
			readBooleanField(step.report_payload, 'audit_context_truncated') ===
				true ? (
				<p className="text-xs leading-relaxed text-(--desktop-text-muted) wrap-pretty">
					{t('amkaView.auditContextTruncatedHint')}
				</p>
			) : null}
			{imcTypeKey ? (
				<div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-2.5 py-1 text-xs text-(--desktop-text-secondary)">
					<span>{t('amkaView.imcTypeKeyStepLabel')}</span>
					<code className="max-w-full truncate font-mono text-[11px] text-(--desktop-text-primary)">
						{imcTypeKey}
					</code>
				</div>
			) : null}
			{isEnsembleStep ? (
				<div className="space-y-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2.5">
					<div className="text-xs font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
						{t('amkaView.ensembleStepTitle')}
					</div>
					{ensembleTemplate ? (
						<div className="text-xs text-(--desktop-text-secondary)">
							<span>{t('amkaView.ensembleTemplateLabel')}</span>{' '}
							<code className="font-mono text-[11px] text-(--desktop-text-primary)">
								{ensembleTemplate}
							</code>
						</div>
					) : null}
					{ensembleHeroIds.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{ensembleHeroIds.map((heroId) => {
								const hero = getDesktopAiHero(heroId);
								return (
									<span
										key={`${step.id}-hero-${heroId}`}
										className="inline-flex items-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)"
										title={heroId}
									>
										{hero?.shortLabel ?? hero?.label ?? heroId}
									</span>
								);
							})}
						</div>
					) : null}
					{ensembleElapsedMs !== null ? (
						<div className="text-[11px] text-(--desktop-text-muted)">
							{t('amkaView.ensembleElapsedMs', {
								value: Math.round(ensembleElapsedMs / 1000),
							})}
						</div>
					) : null}
					{readBooleanField(step.metrics_after, 'ensemble_completed') ===
						true &&
					!ensembleFallback &&
					!ensembleError ? (
						<p className="text-xs leading-relaxed text-emerald-200/90 wrap-pretty">
							{t('amkaView.ensembleCompletedHint')}
						</p>
					) : null}
					{ensembleFallback ? (
						<p className="text-xs leading-relaxed text-amber-200/90 wrap-pretty">
							{t('amkaView.ensembleFallbackHint')}
							{ensembleError
								? ` ${t('amkaView.ensembleErrorDetail', {
										value:
											formatAmkaEnsembleErrorForUi(t, ensembleError) ??
											ensembleError,
									})}`
								: null}
						</p>
					) : ensembleError ? (
						<p className="text-xs leading-relaxed text-red-200/90 wrap-pretty">
							{t('amkaView.ensembleErrorDetail', {
								value:
									formatAmkaEnsembleErrorForUi(t, ensembleError) ??
									ensembleError,
							})}
						</p>
					) : null}
				</div>
			) : null}
			{showGenericStepFailure ? (
				<div className="rounded-(--desktop-radius) border border-red-500/30 bg-red-500/10 px-3 py-2.5">
					<div className="text-xs font-semibold text-red-100">
						{t('amkaView.stepErrorTitle')}
					</div>
					{stepFailure?.stage ? (
						<div className="mt-1 text-[11px] text-red-200/80">
							{t('amkaView.errorStageLabel', { value: stepFailure.stage })}
						</div>
					) : null}
					<p className="mt-1 text-xs leading-relaxed text-red-100/90 wrap-pretty">
						{stepFailure?.message}
					</p>
				</div>
			) : null}
			{step.report_markdown ? (
				<article className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-3">
					<ImcResearchResultMarkdown markdown={step.report_markdown} />
				</article>
			) : (
				<p className="text-sm text-(--desktop-text-secondary)">
					{t('amkaView.stepReportPending')}
				</p>
			)}
			{childJobs.length > 0 ? (
				<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-3">
					<div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
						{t('amkaView.childJobsTitle')}
					</div>
					<ul className="space-y-2 text-sm text-(--desktop-text-secondary)">
						{childJobs.map((job, ji) => {
							const childDl = buildMarketingCabinetDeepLinkForAmkaChildJob(
								{
									kind: readStringField(job, 'kind') ?? undefined,
									external_id: readStringField(job, 'external_id') ?? undefined,
								},
								selectedCompanyId ?? '',
								selectedProjectId ?? ''
							);
							const childNote =
								readStringField(job, 'error') ||
								readStringField(job, 'error_message') ||
								readStringField(job, 'message');
							const childKey =
								String(readStringField(job, 'external_id') ?? '') ||
								String(readStringField(job, 'kind') ?? '') ||
								String(ji);
							return (
								<li
									key={`${step.id}-cj-${childKey}`}
									className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-2"
								>
									<div>
										{t('amkaView.childJobTarget', {
											section: String(job.target_section ?? job.kind ?? '—'),
										})}
									</div>
									<div>
										{t('amkaView.childJobStatus', {
											status: String(job.status ?? '—'),
										})}
									</div>
									{childNote ? (
										<div className="mt-1 wrap-break-word text-xs text-(--desktop-text-secondary)">
											{t('amkaView.childJobMessage', { value: childNote })}
										</div>
									) : null}
									{job.external_id ? (
										<div className="mt-1 font-mono text-[11px] text-(--desktop-text-muted)">
											{String(job.external_id)}
										</div>
									) : null}
									{childDl ? (
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											className="mt-2"
											onClick={() => openCabinetDeepLink(childDl)}
										>
											<ArrowTopRightOnSquareIcon
												className="mr-1 inline h-3.5 w-3.5"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
											{t('amkaView.openInCabinet')}
										</DesktopAppButton>
									) : null}
								</li>
							);
						})}
					</ul>
					{onOpenAiStudio ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="mt-2"
							onClick={onOpenAiStudio}
						>
							{t('amkaView.openAiStudio')}
						</DesktopAppButton>
					) : null}
				</div>
			) : null}
			{step.applied_entities && step.applied_entities.length > 0 ? (
				<div>
					<div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
						{t('amkaView.appliedEntitiesTitle')}
					</div>
					<ul className="space-y-1 text-sm text-(--desktop-text-secondary)">
						{(step.applied_entities ?? []).map((entity) => {
							const et = String(entity.entity_type || '').trim();
							const eid = String(entity.entity_id || entity.id || '').trim();
							const dl =
								et && eid
									? buildMarketingCabinetDeepLinkForAmkaEntity({
											companyId: selectedCompanyId ?? '',
											projectId: selectedProjectId ?? '',
											entityType: et,
											entityId: eid,
										})
									: null;
							return (
								<li
									key={`${step.id}-${String(
										entity.id ||
											entity.entity_id ||
											entity.title ||
											entity.entity_type ||
											'entity'
									)}`}
								>
									<CheckCircleIcon
										className="mr-1 inline h-3.5 w-3.5 text-emerald-300"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{String(
										entity.title ||
											entity.entity_type ||
											t('amkaView.appliedEntityFallback')
									)}
									{dl ? (
										<div className="mt-1">
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => openCabinetDeepLink(dl)}
											>
												<ArrowTopRightOnSquareIcon
													className="mr-1 inline h-3.5 w-3.5"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
												{t('amkaView.openInCabinet')}
											</DesktopAppButton>
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				</div>
			) : null}
			{operationTrail.length > 0 ? (
				<div>
					<div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
						{t('amkaView.operationTrailTitle')}
					</div>
					<ul className="space-y-2 text-sm text-(--desktop-text-secondary)">
						{operationTrail.map((operation, index) => {
							const sourceRefs = readObjectArray(operation.source_refs);
							const rawMutatedIds = (
								operation.result as Record<string, unknown> | null | undefined
							)?.mutated_entity_ids;
							const mutatedIds: string[] = Array.isArray(rawMutatedIds)
								? rawMutatedIds.map((id) => String(id))
								: [];
							const result =
								operation.result &&
								typeof operation.result === 'object' &&
								!Array.isArray(operation.result)
									? (operation.result as Record<string, unknown>)
									: {};
							const resultStatus = readStringField(result, 'status');
							const resultMessage = readStringField(result, 'message');
							const beforeText = summarizeSnapshot(operation.before_snapshot);
							const afterText = summarizeSnapshot(operation.after_snapshot);
							return (
								<li
									key={`${step.id}-operation-${String(
										operation.entity_id || operation.title || index
									)}`}
									className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2"
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium text-(--desktop-text-primary)">
											{String(
												operation.title ||
													operation.expected_effect ||
													operation.kind ||
													t('amkaView.operationFallback')
											)}
										</span>
										{operation.destructive ? (
											<span className="inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-100 ring-1 ring-inset ring-red-500/30">
												{t('amkaView.destructiveBadge')}
											</span>
										) : null}
										{resultStatus ? (
											<span
												className={cn(
													'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
													['completed', 'applied'].includes(resultStatus)
														? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
														: 'bg-amber-500/15 text-amber-100 ring-amber-500/30'
												)}
											>
												{resultStatus}
											</span>
										) : null}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{t('amkaView.operationKindLabel', {
											value: String(operation.kind || '—'),
										})}
									</div>
									{resultMessage ? (
										<div className="mt-1 text-xs text-(--desktop-text-secondary) wrap-break-word">
											{t('amkaView.operationResultMessageLabel', {
												value: resultMessage,
											})}
										</div>
									) : null}
									{operation.reason ? (
										<div className="mt-1">{String(operation.reason)}</div>
									) : null}
									{beforeText ? (
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{t('amkaView.beforeLabel', { value: beforeText })}
										</div>
									) : null}
									{afterText ? (
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{t('amkaView.afterLabel', { value: afterText })}
										</div>
									) : null}
									{sourceRefs.length > 0 ? (
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{t('amkaView.operationSourcesLabel')}:{' '}
											{sourceRefs
												.slice(0, 3)
												.map((ref) => String(ref.title || ref.id || '').trim())
												.filter(Boolean)
												.join(', ')}
										</div>
									) : null}
									{mutatedIds.length > 0 ? (
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{t('amkaView.mutatedEntitiesLabel')}:{' '}
											{mutatedIds.slice(0, 4).map(String).join(', ')}
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				</div>
			) : null}
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--desktop-text-secondary)">
				{step.started_at ? (
					<div>
						{t('amkaView.stepStartedAtLabel', {
							value: formatShortDate(step.started_at),
						})}
					</div>
				) : null}
				{step.completed_at ? (
					<div>
						{t('amkaView.stepCompletedAtLabel', {
							value: formatShortDate(step.completed_at),
						})}
					</div>
				) : null}
				{appliedCount !== null ? (
					<div>
						{t('amkaView.stepAppliedCountLabel', {
							value: String(appliedCount),
						})}
					</div>
				) : null}
			</div>
			{stepError ? (
				<div className="rounded-(--desktop-radius) border border-red-500/25 bg-red-500/10 p-3">
					<div className="text-xs font-semibold uppercase tracking-[0.12em] text-red-100">
						{t('amkaView.stepErrorTitle')}
					</div>
					{stepError.stage ? (
						<div className="mt-1 text-xs text-red-200/80">
							{t('amkaView.errorStageLabel', { value: stepError.stage })}
						</div>
					) : null}
					<div className="mt-2 text-sm text-red-100/90">
						{stepError.message || t('amkaView.errorDetailsFallback')}
					</div>
				</div>
			) : null}
		</div>
	);
}
