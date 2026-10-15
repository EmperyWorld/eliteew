/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-listing comparable price analysis snapshots with AI commentary preview for Realtor Pro insights.
 *
 * Invariants:
 * - Loads snapshots when `property` changes; clears state when no listing is selected.
 * - Latest snapshot drives UI; empty state when history is absent.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export target)
 * - ./InsightsPanel.tsx
 * - ../../api.ts
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { listRealtorPriceAnalysisSnapshots } from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import type {
	RealtorPriceAnalysisSnapshot,
	RealtorProperty,
} from '../../types';

import { type AsyncState, JsonPreview } from './shared';

export function PriceAnalysisPanel({
	property,
}: {
	property: RealtorProperty | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [{ data: snapshots }, setSnapshotsState] = useState<
		AsyncState<RealtorPriceAnalysisSnapshot[]>
	>({
		data: [],
		error: null,
		loading: false,
	});
	useEffect(() => {
		if (!property) {
			setSnapshotsState({ data: [], error: null, loading: false });
			return;
		}
		const propertyId = property.id;
		let alive = true;
		setSnapshotsState((current) => ({
			...current,
			loading: true,
			error: null,
		}));
		listRealtorPriceAnalysisSnapshots(propertyId)
			.then((data) => {
				if (alive) setSnapshotsState({ data, error: null, loading: false });
			})
			.catch((err: unknown) => {
				if (alive) {
					setSnapshotsState({
						data: [],
						error: formatProfessionalWorldsApiError(err, (key) => t(key)),
						loading: false,
					});
				}
			});
		return () => {
			alive = false;
		};
	}, [property, t]);
	const latest = snapshots[0] ?? null;

	return (
		<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
			<strong className="text-sm">
				{t('realtorPro.insights.comparableFacts')}
			</strong>
			{latest ? (
				<>
					<JsonPreview
						value={latest.snapshot}
						summaryKey="realtorPro.insights.snapshotSupportDetails"
					/>
					<p className="text-xs text-(--desktop-text-secondary)">
						{t('realtorPro.insights.aiCommentaryPrefix')}{' '}
						{String(
							latest.snapshot?.commentary ??
								latest.snapshot?.ai_commentary ??
								t('realtorPro.insights.noCommentaryYet')
						)}
					</p>
				</>
			) : (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.insights.noSnapshots')}
				</p>
			)}
		</div>
	);
}
