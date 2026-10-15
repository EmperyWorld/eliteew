/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview pulse banner when stale cross-app draft links need realtor attention.
 *
 * Related:
 * - crossAppDraftLifecycleLogic.ts
 * - OverviewWorkspacePanel.tsx
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { listProfessionalCrossAppDraftLinks } from '../api';
import { countStaleCrossAppDraftLinks } from '../crossAppDraftLifecycleLogic';
import { ProfessionalWorldsStatusBanner } from '../layout';

export function OverviewStaleDraftsBanner({
	onReviewHandoffs,
}: {
	onReviewHandoffs: () => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [staleCount, setStaleCount] = useState(0);

	useEffect(() => {
		let cancelled = false;
		void listProfessionalCrossAppDraftLinks()
			.then((links) => {
				if (!cancelled) {
					setStaleCount(countStaleCrossAppDraftLinks(links));
				}
			})
			.catch(() => {
				if (!cancelled) setStaleCount(0);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (staleCount <= 0) return null;

	return (
		<ProfessionalWorldsStatusBanner kind="warning">
			<div className="grid gap-2">
				<span>{t('overview.staleDrafts.body', { count: staleCount })}</span>
				<DesktopAppButton size="sm" variant="ghost" onClick={onReviewHandoffs}>
					{t('overview.staleDrafts.review')}
				</DesktopAppButton>
			</div>
		</ProfessionalWorldsStatusBanner>
	);
}
