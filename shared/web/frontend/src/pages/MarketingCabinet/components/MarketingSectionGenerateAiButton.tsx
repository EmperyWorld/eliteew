/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Action button that runs project-context AI draft generation for a Marketing Cabinet section.
 *
 * Invariants:
 * - Run status polling is sourced from `marketingCabinetAiRunDetailQueryOptions`.
 * - Post-run cache refresh uses invalidation key helpers/prefixes only.
 *
 * Related:
 * - marketingCabinetQueryOptions.ts
 * - DocumentAutofillAction.tsx
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { cabinetNotify } from '../cabinetNotify';
import {
	marketingCabinetApi,
	type MarketingDocumentAutofillTarget,
} from '../marketingCabinetApi';
import { extractApiErrorMessage, requireDefined } from '../utils';
import {
	invalidateMarketingCabinetAfterAmkaRun,
	marketingCabinetAiRunDetailPollIntervalMs,
	marketingCabinetAiRunDetailQueryOptions,
	marketingCabinetAiRunsProjectInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

export interface MarketingSectionGenerateAiButtonProps {
	projectId: string | null;
	companyId?: string | null;
	targetSection: MarketingDocumentAutofillTarget;
	allowMarketingWrite: boolean;
	invalidateQueryKeys?: readonly (readonly unknown[])[];
	/** Доп. инструкция к RAG (как в модалке «Из документа»). */
	userInstruction?: string;
}

/**
 * Генерация черновиков раздела из контекста проекта + RAG (без файла).
 * Тот же JSON-контракт и UGS-поток, что кнопка «Анализировать» в «Из документа».
 */
export function MarketingSectionGenerateAiButton({
	projectId,
	companyId = null,
	targetSection,
	allowMarketingWrite,
	invalidateQueryKeys = [],
	userInstruction = '',
}: MarketingSectionGenerateAiButtonProps) {
	const { t } = useTranslation('marketing');
	const queryClient = useQueryClient();
	const [runId, setRunId] = React.useState<string | null>(null);

	const runQuery = useQuery({
		...marketingCabinetAiRunDetailQueryOptions(runId),
		enabled: Boolean(runId),
		refetchInterval: (query) =>
			marketingCabinetAiRunDetailPollIntervalMs(query.state.data),
	});

	const generateMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.documentAutofillFromProjectAsync({
				project_id: requireDefined(projectId, 'projectId'),
				target_section: targetSection,
				user_instruction: userInstruction.trim() || undefined,
			}),
		retry: (failureCount, error) => {
			const status = (error as { response?: { status?: number } })?.response
				?.status;
			if (status === 429) return false;
			return failureCount < 2;
		},
		retryDelay: 1500,
		onSuccess: async (response) => {
			setRunId(response.run.id);
			const pid = requireDefined(projectId, 'projectId');
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(pid),
			});
			cabinetNotify.success(
				response.queue?.status === 'queued'
					? t('cabinetPage.notices.sectionProjectGenQueued')
					: t('cabinetPage.notices.sectionProjectGenStarted')
			);
		},
		onError: (error) =>
			cabinetNotify.error(
				extractApiErrorMessage(
					error,
					t('cabinetPage.notices.sectionProjectGenFailed')
				)
			),
	});

	useEffect(() => {
		if (!runId || !runQuery.data) return;
		const statusValue = runQuery.data.run.status;
		if (statusValue === 'completed') {
			void (async () => {
				const pid = requireDefined(projectId, 'projectId');
				invalidateMarketingCabinetAfterAmkaRun(queryClient, {
					projectId: pid,
					companyId,
				});
				await Promise.all(
					invalidateQueryKeys.map((queryKey) =>
						queryClient.invalidateQueries({ queryKey })
					)
				);
				setRunId(null);
				cabinetNotify.success(t('cabinetPage.notices.sectionProjectGenDone'));
			})();
			return;
		}
		if (statusValue === 'failed' || statusValue === 'cancelled') {
			setRunId(null);
			cabinetNotify.error(
				runQuery.data.error || t('cabinetPage.notices.sectionProjectGenFailed')
			);
		}
	}, [
		companyId,
		invalidateQueryKeys,
		projectId,
		queryClient,
		runId,
		runQuery.data,
		t,
	]);

	const busy = generateMutation.isPending || Boolean(runId);
	const disabled = !allowMarketingWrite || !projectId || busy;

	return (
		<DesktopAppButton
			type="button"
			variant="accent"
			size="sm"
			onClick={() => generateMutation.mutate()}
			disabled={disabled}
			aria-label={t('cabinetPage.sectionGenerateAiAria')}
		>
			{busy ? (
				<ArrowPathIcon
					className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			) : (
				<SparklesIcon className="h-4 w-4" strokeWidth={DESKTOP_LUCIDE.stroke} />
			)}
			{runId
				? t('cabinetPage.analysis.generating')
				: t('cabinetPage.analysis.generateWithAi')}
		</DesktopAppButton>
	);
}
