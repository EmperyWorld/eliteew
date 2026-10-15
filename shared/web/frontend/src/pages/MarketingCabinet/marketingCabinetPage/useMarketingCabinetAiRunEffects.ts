/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Side-effect hooks for JTBD extract, SWOT generate, and research AI run polling.
 *
 * Invariants:
 * - Completed runs invalidate project marketing queries and reset local run ids.
 *
 * Related:
 * - useMarketingCabinetProjectEntityQueries.ts, useMarketingCabinetPageCompose.ts
 */

import { useEffect } from 'react';
import type { TFunction } from 'i18next';
import { cabinetNotify } from '@/pages/MarketingCabinet/cabinetNotify';
import {
	coerceMarketingJtbdExtractTotal,
	type MarketingResearch,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import { extractApiErrorMessage } from '@/pages/MarketingCabinet/utils';

type AiRunDetail = {
	run: { status?: string | null };
	error?: string | null;
	result?: { [key: string]: unknown } | null;
};

type AiRunQuerySlice = {
	data?: AiRunDetail;
	isError: boolean;
	error: unknown;
};

type AiRunEffectsInput = {
	t: TFunction<'marketing'>;
	invalidateCurrentProjectMarketing: () => Promise<void>;
	jobStoryExtractRunId: string | null;
	setJobStoryExtractRunId: (id: string | null) => void;
	setJobStorySearch: (v: string) => void;
	setJobStoryExtractText: (v: string) => void;
	jobStoryExtractRunQuery: AiRunQuerySlice;
	swotGenerateRunId: string | null;
	setSwotGenerateRunId: (id: string | null) => void;
	setSwotGenerateContext: (v: string) => void;
	swotGenerateRunQuery: AiRunQuerySlice;
	researchRunPollId: string | null;
	setResearchRunPollId: (id: string | null) => void;
	researchRunTargetId: string | null;
	setResearchRunTargetId: (id: string | null) => void;
	researchRunDetailQuery: AiRunQuerySlice;
	focusedEntityId: string | null;
	researchesItems: MarketingResearch[] | undefined;
};

export function useMarketingCabinetAiRunEffects(input: AiRunEffectsInput) {
	const {
		t,
		invalidateCurrentProjectMarketing,
		jobStoryExtractRunId,
		setJobStoryExtractRunId,
		setJobStorySearch,
		setJobStoryExtractText,
		jobStoryExtractRunQuery,
		swotGenerateRunId,
		setSwotGenerateRunId,
		setSwotGenerateContext,
		swotGenerateRunQuery,
		researchRunPollId,
		setResearchRunPollId,
		setResearchRunTargetId,
		researchRunDetailQuery,
		focusedEntityId,
		researchesItems,
	} = input;

	useEffect(() => {
		setJobStoryExtractRunId(null);
		setSwotGenerateRunId(null);
		setResearchRunPollId(null);
		setResearchRunTargetId(null);
	}, [
		setJobStoryExtractRunId,
		setResearchRunPollId,
		setResearchRunTargetId,
		setSwotGenerateRunId,
	]);

	useEffect(() => {
		if (!jobStoryExtractRunId || !jobStoryExtractRunQuery.data) return;
		const detail = jobStoryExtractRunQuery.data;
		const statusValue = detail.run.status;
		if (statusValue === 'completed') {
			const total = coerceMarketingJtbdExtractTotal(detail);
			void invalidateCurrentProjectMarketing();
			setJobStorySearch('');
			setJobStoryExtractText('');
			setJobStoryExtractRunId(null);
			cabinetNotify.success(
				t('cabinetPage.notices.jobExtractSuccess', { count: total })
			);
			return;
		}
		if (statusValue === 'failed' || statusValue === 'cancelled') {
			setJobStoryExtractRunId(null);
			cabinetNotify.error(
				detail.error || t('cabinetPage.notices.jobExtractFailed')
			);
		}
	}, [
		t,
		invalidateCurrentProjectMarketing,
		jobStoryExtractRunId,
		jobStoryExtractRunQuery.data,
		setJobStoryExtractRunId,
		setJobStoryExtractText,
		setJobStorySearch,
	]);

	useEffect(() => {
		if (!swotGenerateRunId || !swotGenerateRunQuery.data) return;
		const detail = swotGenerateRunQuery.data;
		const statusValue = detail.run.status;
		if (statusValue === 'completed') {
			void invalidateCurrentProjectMarketing();
			setSwotGenerateContext('');
			setSwotGenerateRunId(null);
			cabinetNotify.success(t('cabinetPage.notices.aiSwotGenerated'));
			return;
		}
		if (statusValue === 'failed' || statusValue === 'cancelled') {
			setSwotGenerateRunId(null);
			cabinetNotify.error(
				detail.error || t('cabinetPage.notices.swotGenFailed')
			);
		}
	}, [
		t,
		invalidateCurrentProjectMarketing,
		swotGenerateRunId,
		swotGenerateRunQuery.data,
		setSwotGenerateContext,
		setSwotGenerateRunId,
	]);

	useEffect(() => {
		if (!researchRunPollId || !researchRunDetailQuery.data) return;
		const detail = researchRunDetailQuery.data;
		const statusValue = detail.run.status;
		if (statusValue === 'completed') {
			void invalidateCurrentProjectMarketing();
			setResearchRunPollId(null);
			setResearchRunTargetId(null);
			cabinetNotify.success(t('cabinetPage.notices.researchSynthSaved'));
			return;
		}
		if (statusValue === 'failed' || statusValue === 'cancelled') {
			setResearchRunPollId(null);
			setResearchRunTargetId(null);
			cabinetNotify.error(
				detail.error || t('cabinetPage.notices.researchSynthFailed')
			);
		}
	}, [
		t,
		invalidateCurrentProjectMarketing,
		researchRunPollId,
		researchRunDetailQuery.data,
		setResearchRunPollId,
		setResearchRunTargetId,
	]);

	useEffect(() => {
		if (researchRunPollId) return;
		const items = researchesItems ?? [];
		if (items.length === 0) return;
		const focused =
			focusedEntityId != null
				? items.find((row) => row.id === focusedEntityId)
				: undefined;
		const candidate =
			focused?.status === 'processing' && focused.active_ai_run_id
				? focused
				: items.find(
						(row) =>
							row.status === 'processing' && Boolean(row.active_ai_run_id)
					);
		if (!candidate?.active_ai_run_id) return;
		setResearchRunPollId(candidate.active_ai_run_id);
		setResearchRunTargetId(candidate.id);
	}, [
		focusedEntityId,
		researchRunPollId,
		researchesItems,
		setResearchRunPollId,
		setResearchRunTargetId,
	]);

	useEffect(() => {
		if (!jobStoryExtractRunQuery.isError) return;
		setJobStoryExtractRunId(null);
		cabinetNotify.error(
			extractApiErrorMessage(
				jobStoryExtractRunQuery.error,
				t('cabinetPage.notices.jtbdPollStatusError')
			)
		);
	}, [
		jobStoryExtractRunQuery.error,
		jobStoryExtractRunQuery.isError,
		setJobStoryExtractRunId,
		t,
	]);

	useEffect(() => {
		if (!swotGenerateRunQuery.isError) return;
		setSwotGenerateRunId(null);
		cabinetNotify.error(
			extractApiErrorMessage(
				swotGenerateRunQuery.error,
				t('cabinetPage.notices.swotPollStatusError')
			)
		);
	}, [
		swotGenerateRunQuery.error,
		swotGenerateRunQuery.isError,
		setSwotGenerateRunId,
		t,
	]);

	useEffect(() => {
		if (!researchRunDetailQuery.isError) return;
		setResearchRunPollId(null);
		setResearchRunTargetId(null);
		cabinetNotify.error(
			extractApiErrorMessage(
				researchRunDetailQuery.error,
				t('cabinetPage.notices.researchPollStatusError')
			)
		);
	}, [
		researchRunDetailQuery.error,
		researchRunDetailQuery.isError,
		setResearchRunPollId,
		setResearchRunTargetId,
		t,
	]);
}
