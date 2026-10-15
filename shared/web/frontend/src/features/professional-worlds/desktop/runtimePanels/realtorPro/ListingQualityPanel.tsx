/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-listing quality score history with on-demand recompute for Realtor Pro insights.
 *
 * Invariants:
 * - Loads scores when `property` changes; recompute prepends the latest row locally.
 * - Empty state when no quality history exists for the selected listing.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export target)
 * - ./InsightsPanel.tsx
 * - ../../api.ts
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import {
	listRealtorListingQualityScores,
	recomputeRealtorListingQuality,
} from '../../api';
import type { RealtorListingQualityScore, RealtorProperty } from '../../types';

import { JsonPreview } from './shared';

export function ListingQualityPanel({
	property,
}: {
	property: RealtorProperty | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [scores, setScores] = useState<RealtorListingQualityScore[]>([]);

	useEffect(() => {
		if (!property) return;
		let alive = true;
		listRealtorListingQualityScores(property.id).then((next) => {
			if (alive) setScores(next);
		});
		return () => {
			alive = false;
		};
	}, [property]);

	async function handleRecompute() {
		if (!property) return;
		const score = await recomputeRealtorListingQuality(property.id);
		setScores((current) => [score, ...current]);
	}

	const latest = scores[0] ?? null;
	return (
		<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
			<div className="flex items-center justify-between gap-2">
				<strong className="text-sm">
					{t('realtorPro.insights.listingQuality')}
				</strong>
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() => void handleRecompute()}
				>
					{t('realtorPro.insights.recompute')}
				</DesktopAppButton>
			</div>
			{latest ? (
				<>
					<p className="text-2xl font-semibold">{Math.round(latest.score)}%</p>
					<JsonPreview
						value={latest.breakdown}
						summaryKey="realtorPro.insights.breakdownSupportDetails"
					/>
				</>
			) : (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.insights.noQualityHistory')}
				</p>
			)}
		</div>
	);
}
