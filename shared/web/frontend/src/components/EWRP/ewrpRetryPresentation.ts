/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Energy labels and tooltips for EWRP retry/duplicate actions (failed re-bill vs stale re-queue).
 *
 * Invariants:
 * - Default credits-per-slide matches backend fallback `EWRP_CREDITS_PER_SLIDE` (200).
 * - Prefer server quote `credits_per_slide` when available (create gate / history labels).
 *
 * Related:
 * - `ewrpRetryEligibility.ts`, `EwrpHistoryRow`, `EWRPGeneratorMain`
 */

import { EWRP_CREDITS_PER_SLIDE } from './EwrpGeneratorChunks';
import { ewrpJobRetryRequiresBilling } from './ewrpRetryEligibility';

/** Full presentation billing: create, duplicate, failed retry. */
export function ewrpJobSlideEnergyCredits(
	numSlides: number,
	creditsPerSlide: number = EWRP_CREDITS_PER_SLIDE
): number {
	const slides = Math.max(1, Number.isFinite(numSlides) ? numSlides : 5);
	const per =
		Number.isFinite(creditsPerSlide) && creditsPerSlide > 0
			? Math.round(creditsPerSlide)
			: EWRP_CREDITS_PER_SLIDE;
	return slides * per;
}

export function ewrpRetryEnergyCredits(
	status: string,
	numSlides: number,
	creditsPerSlide: number = EWRP_CREDITS_PER_SLIDE
): number {
	if (!ewrpJobRetryRequiresBilling(status)) {
		return 0;
	}
	return ewrpJobSlideEnergyCredits(numSlides, creditsPerSlide);
}

export type EwrpRetryEnergyI18n = {
	retryTitleFailed: (params: { total: number }) => string;
	retryTitleStale: () => string;
	retryEnergyFree: () => string;
	retryEnergyBilled: (params: { total: number }) => string;
};

export function ewrpRetryEnergyDetail(
	status: string,
	numSlides: number,
	i18n: EwrpRetryEnergyI18n,
	creditsPerSlide: number = EWRP_CREDITS_PER_SLIDE
): string {
	const credits = ewrpRetryEnergyCredits(status, numSlides, creditsPerSlide);
	if (credits === 0) {
		return i18n.retryEnergyFree();
	}
	return i18n.retryEnergyBilled({ total: credits });
}

export function ewrpRetryButtonTitle(
	status: string,
	numSlides: number,
	i18n: EwrpRetryEnergyI18n,
	creditsPerSlide: number = EWRP_CREDITS_PER_SLIDE
): string {
	if (ewrpJobRetryRequiresBilling(status)) {
		return i18n.retryTitleFailed({
			total: ewrpRetryEnergyCredits(status, numSlides, creditsPerSlide),
		});
	}
	return i18n.retryTitleStale();
}
