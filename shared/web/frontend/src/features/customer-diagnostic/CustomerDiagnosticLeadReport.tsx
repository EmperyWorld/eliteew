import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useImcRunResearch } from '@/hooks/api/useImcResearch';
import { useNotifications } from '@/notifications';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useMarketingShellClasses } from '@/pages/MarketingCabinet/hooks/useMarketingShellClasses';
import type { CustomerDiagnosticSession } from '@/pages/MarketingCabinet/marketingCabinetApi';
import { marketingCabinetCustomerDiagnosticSessionLeadQueryOptions } from '@/pages/MarketingCabinet/marketingCabinetClientInteractionQueryOptions';
import { extractApiErrorMessage } from '@/pages/MarketingCabinet/utils';
import { cn } from '@/utils/cn';

import {
	buildCustomerDiagnosticDocumentText,
	buildCustomerDiagnosticImcAnswersBrief,
	buildCustomerDiagnosticImcBrief,
	type CustomerDiagnosticImcBriefVariant,
	IMC_CUSTOMER_DIAGNOSTIC_ANSWERS_TYPE_KEY,
	IMC_CUSTOMER_DIAGNOSTIC_TYPE_KEY,
} from './customerDiagnosticImcContext';
import { CustomerDiagnosticImcAnalysisModal } from './CustomerDiagnosticImcAnalysisModal';
import { DiagnosticAnswersReadonly } from './DiagnosticAnswersReadonly';
import { DiagnosticResultsSection } from './DiagnosticResultsSection';
import {
	formatDiagnosticIsoDateTime,
	formatDiagnosticModuleKeyLabel,
} from './diagnosticUiFormat';
import { computeAllResults } from './diagnosticScoring';
import {
	applyDiagnosticLoadHints,
	reconcileCompletedModules,
} from './diagnosticSessionLoadHints';
import type { CustomerDiagnosticSessionState } from './diagnosticTypes';
import { normalizeSessionState } from './diagnosticTypes';
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export type CustomerDiagnosticLeadReportProps = {
	projectId: string;
	className?: string;
	/** Родитель уже показал заголовок секции (маркетинговый кабинет). */
	omitSectionTitle?: boolean;
};

type DiagnosticImcRunKind = CustomerDiagnosticImcBriefVariant | 'answers';

function CustomerDiagnosticLeadReportLoaded({
	projectId,
	session,
	className,
	omitSectionTitle = false,
}: {
	projectId: string;
	session: CustomerDiagnosticSession;
	className?: string;
	omitSectionTitle?: boolean;
}) {
	const { t: tMc, i18n } = useTranslation('marketing');
	const { t: tDiag } = useTranslation('customerCabinet');
	const { progressTrack } = useMarketingShellClasses();
	const { error: toastError } = useNotifications();
	const runImcMutation = useImcRunResearch();
	const [imcModalOpen, setImcModalOpen] = useState(false);
	const [imcResearchId, setImcResearchId] = useState<string | null>(null);
	const [imcActiveKind, setImcActiveKind] =
		useState<DiagnosticImcRunKind | null>(null);

	const norm: CustomerDiagnosticSessionState = applyDiagnosticLoadHints(
		normalizeSessionState(session.state),
		session
	);
	const answers = norm.answers;
	const hasAnyAnswers =
		answers && typeof answers === 'object' && Object.keys(answers).length > 0;

	const results =
		(session.computed_results as ReturnType<typeof computeAllResults> | null) ??
		computeAllResults(answers);
	const completed = reconcileCompletedModules(norm);
	const hasSummary =
		results.archetype !== null ||
		results.values !== null ||
		results.business !== null ||
		results.service !== null ||
		results.emotions !== null;

	const baseImcEnabled =
		Boolean(session.company_id?.trim()) && (hasSummary || hasAnyAnswers);
	const imcButtonsDisabled = !baseImcEnabled || runImcMutation.isPending;

	const progressPct = Math.min(
		100,
		Math.max(0, Math.round(session.progress_percent))
	);
	const updatedLabel = session.updated_at
		? formatDiagnosticIsoDateTime(session.updated_at, i18n.language)
		: null;

	const modulesDoneLabel = completed
		.map((id) => formatDiagnosticModuleKeyLabel(id, tDiag))
		.join(', ');

	const runDiagnosticImc = useCallback(
		async (kind: DiagnosticImcRunKind) => {
			const companyId = session.company_id?.trim();
			if (!companyId) {
				toastError(
					tMc('clientInteractionView.customerDiagnostic.imcNoCompany'),
					''
				);
				return;
			}
			const documentText = buildCustomerDiagnosticDocumentText({
				session,
				state: norm,
				computedResults: results,
				completedModules: completed,
			});
			const typeKey =
				kind === 'answers'
					? IMC_CUSTOMER_DIAGNOSTIC_ANSWERS_TYPE_KEY
					: IMC_CUSTOMER_DIAGNOSTIC_TYPE_KEY;
			const brief =
				kind === 'answers'
					? buildCustomerDiagnosticImcAnswersBrief(results)
					: buildCustomerDiagnosticImcBrief(kind, results);
			setImcActiveKind(kind);
			try {
				const res = await runImcMutation.mutateAsync({
					type_key: typeKey,
					company_id: companyId,
					project_id: projectId,
					input_file_ids: [],
					context: {
						brief,
						document_text: documentText,
					},
					language: 'russian',
					idempotency_key: crypto.randomUUID(),
				});
				setImcResearchId(res.id);
				setImcModalOpen(true);
			} catch (err) {
				toastError(
					tMc('clientInteractionView.customerDiagnostic.imcRunError'),
					extractApiErrorMessage(
						err,
						tMc('clientInteractionView.customerDiagnostic.imcRunError')
					)
				);
			} finally {
				setImcActiveKind(null);
			}
		},
		[
			completed,
			norm,
			projectId,
			results,
			runImcMutation,
			session,
			tMc,
			toastError,
		]
	);

	return (
		<div
			className={cn(
				'flex flex-col gap-4',
				!omitSectionTitle &&
					'mt-4 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-3',
				className
			)}
		>
			<div>
				{!omitSectionTitle ? (
					<DesktopAppSectionLabel>
						{tMc('clientInteractionView.customerDiagnostic.leadReportTitle')}
					</DesktopAppSectionLabel>
				) : null}
				<p
					className={cn(
						'text-xs text-(--desktop-text-secondary)',
						omitSectionTitle ? '' : 'mt-1'
					)}
				>
					{tMc('clientInteractionView.customerDiagnostic.leadReportHint')}
				</p>
				<div className="mt-3 space-y-1.5">
					<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-(--desktop-text-secondary)">
						<span>
							{tMc(
								'clientInteractionView.customerDiagnostic.leadReportProgress',
								{
									percent: progressPct,
								}
							)}
						</span>
						{updatedLabel ? (
							<span className="tabular-nums text-(--desktop-text-muted)">
								{tMc(
									'clientInteractionView.customerDiagnostic.leadReportUpdated',
									{
										time: updatedLabel,
									}
								)}
							</span>
						) : null}
					</div>
					<div className={progressTrack}>
						<div
							className="h-2 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.65)] transition-[width]"
							style={{ width: `${Math.max(2, progressPct)}%` }}
						/>
					</div>
				</div>
			</div>

			{hasSummary ? (
				<DiagnosticResultsSection
					results={results}
					t={tDiag}
					className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-3"
				/>
			) : (
				<p className="text-xs text-(--desktop-text-secondary)">
					{tMc('clientInteractionView.customerDiagnostic.leadReportNoScores')}
				</p>
			)}

			{hasAnyAnswers ? (
				<div className="border-t border-(--desktop-border-subtle) pt-3">
					<details className="group [&_summary::-webkit-details-marker]:hidden">
						<summary className="cursor-pointer list-none rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 px-3 py-2.5">
							<div className="flex items-center gap-2">
								<ChevronRightIcon
									className="h-4 w-4 shrink-0 text-(--desktop-text-muted) transition-transform group-open:rotate-90"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								<span className="text-sm font-semibold text-(--desktop-text-primary)">
									{tMc('clientInteractionView.customerDiagnostic.answersTitle')}
								</span>
							</div>
						</summary>
						<div className="mt-3">
							<DiagnosticAnswersReadonly answers={answers} />
						</div>
					</details>
				</div>
			) : (
				<p className="text-xs text-(--desktop-text-secondary)">
					{tMc('clientInteractionView.customerDiagnostic.leadReportNoAnswers')}
				</p>
			)}

			{completed.length > 0 ? (
				<p className="text-[0.65rem] text-(--desktop-text-secondary)">
					{tMc(
						'clientInteractionView.customerDiagnostic.leadReportModulesDone',
						{
							modules: modulesDoneLabel,
						}
					)}
				</p>
			) : null}

			<div className="border-t border-(--desktop-border-subtle) pt-3">
				<h3 className="mb-1 text-sm font-semibold text-(--desktop-text-primary)">
					{tMc('clientInteractionView.customerDiagnostic.imcSectionTitle')}
				</h3>
				<p className="mb-2 text-xs text-(--desktop-text-secondary)">
					{tMc('clientInteractionView.customerDiagnostic.imcSectionHint')}
				</p>
				{runImcMutation.isPending ? (
					<p className="mb-2 text-xs text-(--desktop-text-secondary)">
						{tMc('clientInteractionView.customerDiagnostic.imcRunning')}
					</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={imcButtonsDisabled}
						className="gap-1.5"
						onClick={() => void runDiagnosticImc('strategy')}
					>
						{runImcMutation.isPending && imcActiveKind === 'strategy' ? (
							<ArrowPathIcon
								className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						) : null}
						{tMc('clientInteractionView.customerDiagnostic.imcAnalyzeStrategy')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={imcButtonsDisabled}
						className="gap-1.5"
						onClick={() => void runDiagnosticImc('operations')}
					>
						{runImcMutation.isPending && imcActiveKind === 'operations' ? (
							<ArrowPathIcon
								className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						) : null}
						{tMc(
							'clientInteractionView.customerDiagnostic.imcAnalyzeOperations'
						)}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={imcButtonsDisabled}
						className="gap-1.5"
						onClick={() => void runDiagnosticImc('answers')}
					>
						{runImcMutation.isPending && imcActiveKind === 'answers' ? (
							<ArrowPathIcon
								className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						) : null}
						{tMc('clientInteractionView.customerDiagnostic.imcAnalyzeAnswers')}
					</DesktopAppButton>
				</div>
				{!baseImcEnabled && !runImcMutation.isPending ? (
					<p className="mt-2 text-[0.65rem] text-(--desktop-text-secondary)">
						{!session.company_id
							? tMc('clientInteractionView.customerDiagnostic.imcNoCompany')
							: tMc(
									'clientInteractionView.customerDiagnostic.imcAnalyzeDisabled'
								)}
					</p>
				) : null}
			</div>

			<CustomerDiagnosticImcAnalysisModal
				isOpen={imcModalOpen}
				onClose={() => {
					setImcModalOpen(false);
					setImcResearchId(null);
				}}
				researchId={imcResearchId}
			/>
		</div>
	);
}

export function CustomerDiagnosticLeadReport({
	projectId,
	className,
	omitSectionTitle = false,
}: CustomerDiagnosticLeadReportProps) {
	const { t: tMc } = useTranslation('marketing');

	const sessionQuery = useQuery({
		...marketingCabinetCustomerDiagnosticSessionLeadQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	if (sessionQuery.isLoading) {
		return (
			<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
				<ArrowPathIcon
					className="h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				{tMc('clientInteractionView.customerDiagnostic.leadReportLoading')}
			</div>
		);
	}

	if (sessionQuery.isError || !sessionQuery.data) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-red-300">
					{tMc('clientInteractionView.customerDiagnostic.leadReportError')}
				</p>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					onClick={() => void sessionQuery.refetch()}
				>
					{tMc('clientInteractionView.customerDiagnostic.leadReportRetry')}
				</DesktopAppButton>
			</div>
		);
	}

	const session = sessionQuery.data;
	const emptySession =
		session.id === '00000000-0000-0000-0000-000000000000' ||
		(session.progress_percent === 0 &&
			Object.keys(session.state ?? {}).length === 0);

	if (emptySession) {
		return (
			<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
				{tMc('clientInteractionView.customerDiagnostic.leadReportEmpty')}
			</p>
		);
	}

	return (
		<CustomerDiagnosticLeadReportLoaded
			projectId={projectId}
			session={session}
			className={className}
			omitSectionTitle={omitSectionTitle}
		/>
	);
}
