import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { formatDiagnosticIsoDateTime } from '@/features/customer-diagnostic/diagnosticUiFormat';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	marketingCabinetCustomerDiagnosticAdminOverviewQueryKey,
	marketingCabinetCustomerDiagnosticAdminOverviewQueryOptions,
	marketingCabinetCustomerDiagnosticInvalidationQueryKey,
} from '../marketingCabinetClientInteractionQueryOptions';
import { marketingCabinetApi } from '../marketingCabinetApi';
import { cn } from '@/utils/cn';

export type ClientInteractionDiagnosticPanelProps = {
	projectId: string;
	/** Родитель уже показал заголовок секции (маркетинговый кабинет). */
	hideTitle?: boolean;
};

export function ClientInteractionDiagnosticPanel({
	projectId,
	hideTitle = false,
}: ClientInteractionDiagnosticPanelProps) {
	const { t, i18n } = useTranslation('marketing');
	const { t: tCustomer } = useTranslation('customerCabinet');
	const qc = useQueryClient();

	const moduleLabel = React.useCallback(
		(key: string) =>
			tCustomer(`diagnostic.moduleSubtitle.${key}`, { defaultValue: key }),
		[tCustomer]
	);

	const formatResetPosition = React.useCallback(
		(raw: string | null | undefined) => {
			const s = (raw ?? '').trim();
			if (!s) return '—';
			return t(`clientInteractionView.diagnosticPanel.userRole.${s}`, {
				defaultValue: s,
			});
		},
		[t]
	);

	const overviewQuery = useQuery({
		...marketingCabinetCustomerDiagnosticAdminOverviewQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	const resolveMutation = useMutation({
		mutationFn: ({
			requestId,
			approve,
		}: {
			requestId: string;
			approve: boolean;
		}) =>
			marketingCabinetApi.resolveDiagnosticRetakeRequest(projectId, requestId, {
				approve,
			}),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey:
					marketingCabinetCustomerDiagnosticAdminOverviewQueryKey(projectId),
			});
		},
	});

	const resetMutation = useMutation({
		mutationFn: () => marketingCabinetApi.postDiagnosticFullReset(projectId),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey:
					marketingCabinetCustomerDiagnosticAdminOverviewQueryKey(projectId),
			});
			void qc.invalidateQueries({
				queryKey: marketingCabinetCustomerDiagnosticInvalidationQueryKey(),
			});
		},
	});

	const [confirmReset, setConfirmReset] = React.useState(false);

	if (overviewQuery.isLoading) {
		return (
			<div
				className={cn(
					'flex items-center gap-2 text-sm text-(--desktop-text-secondary)',
					DESKTOP_TYPOGRAPHY.meta
				)}
			>
				<ArrowPathIcon
					className="h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				{t('clientInteractionView.diagnosticPanel.loading')}
			</div>
		);
	}

	if (overviewQuery.isError || !overviewQuery.data) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-red-300">
					{t('clientInteractionView.diagnosticPanel.loadError')}
				</p>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					onClick={() => void overviewQuery.refetch()}
				>
					{t('clientInteractionView.diagnosticPanel.retry')}
				</DesktopAppButton>
			</div>
		);
	}

	const data = overviewQuery.data;
	const repLabel = data.representative_user_id ?? '—';
	const noHistory = data.runs.length === 0 && data.attempts.length === 0;

	return (
		<div className="flex flex-col gap-4">
			<div>
				{!hideTitle ? (
					<>
						<DesktopAppSectionLabel>
							{t('clientInteractionView.diagnosticPanel.title')}
						</DesktopAppSectionLabel>
						<p className="mt-1 text-xs text-(--desktop-text-secondary)">
							{t('clientInteractionView.diagnosticPanel.hint')}
						</p>
					</>
				) : (
					<p className="text-xs text-(--desktop-text-secondary)">
						{t('clientInteractionView.diagnosticPanel.hint')}
					</p>
				)}
				<p className="mt-2 text-xs text-(--desktop-text-secondary)">
					{t('clientInteractionView.diagnosticPanel.repLabel')}:{' '}
					<span className="font-mono text-(--desktop-text-primary)">
						{repLabel}
					</span>
				</p>
			</div>

			{data.pending_retake_requests.length > 0 ? (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
					<p className="mb-2 text-sm font-medium text-(--desktop-text-primary)">
						{t('clientInteractionView.diagnosticPanel.pendingTitle')}
					</p>
					<ul className="space-y-2">
						{data.pending_retake_requests.map((r) => (
							<li
								key={r.id}
								className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/15 px-2 py-2 text-xs"
							>
								<span className="text-(--desktop-text-primary)">
									{moduleLabel(r.module_key)}
								</span>
								<div className="flex gap-2">
									<DesktopAppButton
										type="button"
										variant="accent"
										disabled={resolveMutation.isPending}
										onClick={() =>
											resolveMutation.mutate({ requestId: r.id, approve: true })
										}
									>
										{t('clientInteractionView.diagnosticPanel.approve')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="neutral"
										disabled={resolveMutation.isPending}
										onClick={() =>
											resolveMutation.mutate({
												requestId: r.id,
												approve: false,
											})
										}
									>
										{t('clientInteractionView.diagnosticPanel.reject')}
									</DesktopAppButton>
								</div>
							</li>
						))}
					</ul>
				</div>
			) : null}

			<section
				className="rounded-lg border border-red-500/35 bg-red-500/10 p-3"
				aria-label={t('clientInteractionView.diagnosticPanel.fullReset')}
			>
				<p className="mb-2 text-xs text-(--desktop-text-secondary)">
					{t('clientInteractionView.diagnosticPanel.resetDangerHint')}
				</p>
				<div className="flex flex-wrap items-center gap-2">
					{confirmReset ? (
						<>
							<p className="text-xs text-amber-200">
								{t('clientInteractionView.diagnosticPanel.resetConfirm')}
							</p>
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={resetMutation.isPending}
								onClick={() => {
									resetMutation.mutate();
									setConfirmReset(false);
								}}
							>
								{t('clientInteractionView.diagnosticPanel.resetYes')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								onClick={() => setConfirmReset(false)}
							>
								{t('clientInteractionView.diagnosticPanel.resetNo')}
							</DesktopAppButton>
						</>
					) : (
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => setConfirmReset(true)}
						>
							{t('clientInteractionView.diagnosticPanel.fullReset')}
						</DesktopAppButton>
					)}
				</div>
			</section>

			{noHistory ? (
				<p className="text-xs text-(--desktop-text-secondary)">
					{t('clientInteractionView.diagnosticPanel.historyEmpty')}
				</p>
			) : (
				<>
					<section
						className="overflow-x-auto rounded-lg border border-(--desktop-border-subtle)"
						aria-label={t(
							'clientInteractionView.diagnosticPanel.runsTableCaption'
						)}
					>
						<table className="w-full min-w-[900px] border-collapse text-left text-xs">
							<caption className="sr-only">
								{t('clientInteractionView.diagnosticPanel.runsTableCaption')}
							</caption>
							<thead>
								<tr className="border-b border-(--desktop-border-subtle) bg-(--desktop-surface-muted)">
									<th className="p-2 font-medium">
										{t('clientInteractionView.diagnosticPanel.colRun')}
									</th>
									<th className="p-2 font-medium">
										{t('clientInteractionView.diagnosticPanel.colCreated')}
									</th>
									<th className="p-2 font-medium">
										{t('clientInteractionView.diagnosticPanel.colCompleted')}
									</th>
									<th className="p-2 font-medium">
										{t('clientInteractionView.diagnosticPanel.colAggregate')}
									</th>
									<th className="p-2 font-medium">
										{t(
											'clientInteractionView.diagnosticPanel.colResetDisplayName'
										)}
									</th>
									<th className="p-2 font-medium">
										{t(
											'clientInteractionView.diagnosticPanel.colResetUsername'
										)}
									</th>
									<th className="p-2 font-medium">
										{t(
											'clientInteractionView.diagnosticPanel.colResetPosition'
										)}
									</th>
								</tr>
							</thead>
							<tbody>
								{data.runs.length === 0 ? (
									<tr>
										<td
											colSpan={7}
											className="p-3 text-center text-(--desktop-text-muted)"
										>
											—
										</td>
									</tr>
								) : (
									data.runs.map((run) => (
										<tr
											key={run.id}
											className="border-b border-(--desktop-border-subtle)/60"
										>
											<td className="p-2 tabular-nums">{run.run_index}</td>
											<td className="p-2 font-mono text-[0.65rem] text-(--desktop-text-secondary)">
												{formatDiagnosticIsoDateTime(
													run.created_at,
													i18n.language
												)}
											</td>
											<td className="p-2 font-mono text-[0.65rem] text-(--desktop-text-secondary)">
												{run.full_completed_at
													? formatDiagnosticIsoDateTime(
															run.full_completed_at,
															i18n.language
														)
													: '—'}
											</td>
											<td className="p-2">{run.has_aggregate ? '✓' : '—'}</td>
											<td className="max-w-40 truncate p-2 text-(--desktop-text-primary)">
												{run.reset_initiator_full_name?.trim() || '—'}
											</td>
											<td className="p-2 font-mono text-[0.65rem] text-(--desktop-text-secondary)">
												{run.reset_initiator_username?.trim() || '—'}
											</td>
											<td className="max-w-36 truncate p-2 text-(--desktop-text-secondary)">
												{formatResetPosition(run.reset_initiator_position)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</section>

					<div>
						<p className="mb-2 text-sm font-medium text-(--desktop-text-primary)">
							{t('clientInteractionView.diagnosticPanel.attemptsTitle')}
						</p>
						<section
							className="max-h-64 overflow-auto rounded-lg border border-(--desktop-border-subtle)"
							aria-label={t(
								'clientInteractionView.diagnosticPanel.attemptsTableCaption'
							)}
						>
							<table className="w-full min-w-[640px] border-collapse text-left text-[0.65rem]">
								<caption className="sr-only">
									{t(
										'clientInteractionView.diagnosticPanel.attemptsTableCaption'
									)}
								</caption>
								<thead>
									<tr className="sticky top-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-muted)">
										<th className="p-2">
											{t('clientInteractionView.diagnosticPanel.colModule')}
										</th>
										<th className="p-2">#</th>
										<th className="p-2">
											{t('clientInteractionView.diagnosticPanel.colWhen')}
										</th>
										<th className="p-2">
											{t('clientInteractionView.diagnosticPanel.colLead')}
										</th>
									</tr>
								</thead>
								<tbody>
									{data.attempts.length === 0 ? (
										<tr>
											<td
												colSpan={4}
												className="p-3 text-center text-(--desktop-text-muted)"
											>
												—
											</td>
										</tr>
									) : (
										data.attempts.map((a) => (
											<tr
												key={a.id}
												className="border-b border-(--desktop-border-subtle)/60"
											>
												<td className="p-2">{moduleLabel(a.module_key)}</td>
												<td className="p-2 tabular-nums">{a.attempt_no}</td>
												<td className="p-2 font-mono">
													{formatDiagnosticIsoDateTime(
														a.completed_at,
														i18n.language
													)}
												</td>
												<td className="p-2 font-mono">
													{a.lead_user_id_snapshot?.slice(0, 8) ?? '—'}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</section>
					</div>
				</>
			)}
		</div>
	);
}
