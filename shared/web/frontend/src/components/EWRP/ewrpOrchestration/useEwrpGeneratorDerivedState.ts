/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derived labels and energy quote memos for EWRP compose (status banner, UGS estimates).
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`
 */

import { useCreativeStudioUgsCosts } from '@/hooks/useCreativeStudioUgsCosts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
	EWRP_CREDITS_PER_SLIDE,
	EWRP_PRESENTATION_THEME_IDS,
	type EwrpPresentationThemeId,
	ewrpHistoryStatusIndicator,
} from '../EwrpGeneratorChunks';
import {
	resolveEwrpGenerateWorkspaceLabel,
	resolveEwrpStatusPresentationLabel,
} from '../ewrpGenerateWorkspaceLabel';
import {
	buildEwrpHistoryRowEnergyLabels,
	type EwrpHistoryRowEnergyI18n,
} from '../ewrpHistoryRowEnergyLabels';
import { resolveEwrpStatusSlideCount } from '../ewrpStickyContextMismatch';
import {
	ewrpApi,
	type EwrpSlide,
	type EwrpStatusResponse,
} from '@/services/ewrpApi';

export type UseEwrpGeneratorDerivedStateParams = {
	t: (key: string, opts?: Record<string, unknown>) => string;
	topic: string;
	title: string;
	numSlides: number;
	status: EwrpStatusResponse | null;
	draftSlides: EwrpSlide[] | null;
	jobId: string | null;
	applyingInputsId: string | null;
	duplicatingId: string | null;
	retryingId: string | null;
};

export function useEwrpGeneratorDerivedState(
	params: UseEwrpGeneratorDerivedStateParams
) {
	const {
		t,
		topic,
		title,
		numSlides,
		status,
		draftSlides,
		jobId,
		applyingInputsId,
		duplicatingId,
		retryingId,
	} = params;

	const { data: ewrpQuote } = useQuery({
		queryKey: ['ewrp', 'quote', numSlides],
		queryFn: () => ewrpApi.getQuote(numSlides),
		staleTime: 30_000,
	});
	const perSlideCredits =
		ewrpQuote?.credits_per_slide != null &&
		Number.isFinite(ewrpQuote.credits_per_slide) &&
		ewrpQuote.credits_per_slide > 0
			? Math.round(Number(ewrpQuote.credits_per_slide))
			: EWRP_CREDITS_PER_SLIDE;
	const presentationEnergyCost =
		ewrpQuote?.credit_cost != null && Number.isFinite(ewrpQuote.credit_cost)
			? Math.round(Number(ewrpQuote.credit_cost))
			: numSlides * perSlideCredits;
	const ugsAvailableCredits =
		ewrpQuote?.available_credits != null
			? Math.floor(Number(ewrpQuote.available_credits))
			: null;
	const insufficientEnergy =
		ewrpQuote != null
			? ewrpQuote.allowed === false
			: ugsAvailableCredits != null &&
				ugsAvailableCredits < presentationEnergyCost;

	const actionEnergyI18n = useMemo<EwrpHistoryRowEnergyI18n>(
		() => ({
			retryTitleFailed: (p) => t('form.retryTitleFailed', p),
			retryTitleStale: () => t('form.retryTitleStale'),
			retryEnergyFree: () => t('form.retryEnergyFree'),
			retryEnergyBilled: (p) => t('form.retryEnergyBilled', p),
			duplicateEnergyBilled: (p) => t('form.duplicateEnergyBilled', p),
			duplicateTitleWithEnergy: (p) => t('form.duplicateTitleWithEnergy', p),
		}),
		[t]
	);
	const statusActionLabels = useMemo(() => {
		if (!status) return null;
		return buildEwrpHistoryRowEnergyLabels(
			{
				status: status.status,
				num_slides: status.num_slides ?? numSlides,
				updated_at: status.updated_at ?? null,
			},
			actionEnergyI18n,
			Date.now(),
			perSlideCredits
		);
	}, [status, numSlides, actionEnergyI18n, perSlideCredits]);
	const statusIndicator = useMemo(() => {
		if (!status) return null;
		return ewrpHistoryStatusIndicator(status.status, status.updated_at);
	}, [status]);
	const statusPresentationLabel = useMemo(
		() =>
			resolveEwrpStatusPresentationLabel({
				statusTitle: status?.title,
				statusTopic: status?.topic,
			}),
		[status?.title, status?.topic]
	);
	const generateWorkspaceLabel = useMemo(
		() =>
			resolveEwrpGenerateWorkspaceLabel({
				formTopic: topic,
				formTitle: title,
				statusTitle: status?.title,
				statusTopic: status?.topic,
			}),
		[topic, title, status?.title, status?.topic]
	);
	const activeJobBannerHeadline =
		generateWorkspaceLabel || t('form.activeJobUntitled');
	const statusMetaSlideCount = useMemo(
		() => resolveEwrpStatusSlideCount(status),
		[status]
	);
	const statusMetaThemeLabel = useMemo(() => {
		const themeId = (status?.presentation_theme || '').trim();
		if (!themeId) return null;
		if ((EWRP_PRESENTATION_THEME_IDS as readonly string[]).includes(themeId)) {
			return t(`themes.${themeId as EwrpPresentationThemeId}.title`);
		}
		return themeId;
	}, [status?.presentation_theme, t]);
	const statusActionsBusy = useMemo(
		() =>
			applyingInputsId === jobId ||
			duplicatingId === jobId ||
			retryingId === jobId,
		[applyingInputsId, duplicatingId, jobId, retryingId]
	);

	const { costByTypeKey } = useCreativeStudioUgsCosts();
	const EWRP_FALLBACK_UGS_IMAGE_CREDITS = 50;
	const estimatedSlidesNeedingNewUgs = useMemo(() => {
		if (!draftSlides?.length) return 0;
		return draftSlides.filter((s) => !s.image_filename).length;
	}, [draftSlides]);
	const perUgsImageCredits = useMemo(() => {
		const c = costByTypeKey.get('image_generation_comfyui');
		if (c != null && !Number.isNaN(c)) return Math.round(Number(c));
		return EWRP_FALLBACK_UGS_IMAGE_CREDITS;
	}, [costByTypeKey]);
	const estimatedNewImagesEnergy =
		estimatedSlidesNeedingNewUgs * perUgsImageCredits;

	return {
		perSlideCredits,
		presentationEnergyCost,
		ugsAvailableCredits,
		insufficientEnergy,
		statusActionLabels,
		statusIndicator,
		statusPresentationLabel,
		activeJobBannerHeadline,
		statusMetaSlideCount,
		statusMetaThemeLabel,
		statusActionsBusy,
		estimatedSlidesNeedingNewUgs,
		estimatedNewImagesEnergy,
	};
}
