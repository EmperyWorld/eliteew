/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes Marketing Cabinet project overview from overview/* panels and derived view-model.
 *
 * Invariants:
 * - Overview remains project-scoped and must not mutate dashboard data directly.
 * - Performance analytics are additive and do not replace readiness metrics.
 * - Named export `OverviewView` preserved for marketingCabinetPageLazyImports lazy path.
 *
 * Related:
 * - views/OverviewView.tsx (facade)
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppErrorState,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { EmptyProjectState } from '@/pages/MarketingCabinet/components/EmptyProjectState';
import { OverviewSkeleton } from '@/pages/MarketingCabinet/components/OverviewSkeleton';
import { useMarketingShellClasses } from '@/pages/MarketingCabinet/hooks/useMarketingShellClasses';

import { OverviewActivityPanels } from './OverviewActivityPanels';
import { OverviewAnalyticsPanels } from './OverviewAnalyticsPanels';
import { OverviewHeroMetrics } from './OverviewHeroMetrics';
import { deriveOverviewViewModel } from './overviewViewModel';
import type { OverviewViewProps } from './overviewViewTypes';

export type { OverviewViewProps } from './overviewViewTypes';

export function OverviewView({
	selectedProjectId,
	selectedProject,
	dashboard,
	isLoading,
	isError,
	error,
	refetch,
	latestSwot,
	extractApiErrorMessage,
	onNavigate,
	allowMarketingWrite: _allowMarketingWrite,
}: OverviewViewProps) {
	const { t } = useTranslation('marketing');
	const { toolbarInset, progressTrack } = useMarketingShellClasses();
	const [gapsExpanded, setGapsExpanded] = useState(false);

	if (!selectedProjectId || !selectedProject) {
		return (
			<EmptyProjectState
				title={t('overview.emptyTitle')}
				description={t('overview.emptyDescription')}
			/>
		);
	}

	if (isLoading) {
		return (
			<div className="min-w-0">
				<OverviewSkeleton />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="min-w-0">
				<DesktopAppSurface variant="soft" className="overflow-hidden p-0">
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							error,
							t('overview.loadErrorDefault')
						)}
						onAction={() => void refetch()}
					/>
				</DesktopAppSurface>
			</div>
		);
	}

	if (!dashboard) {
		return (
			<EmptyProjectState
				title={t('overview.noDataTitle')}
				description={t('overview.noDataDescription')}
			/>
		);
	}

	const vm = deriveOverviewViewModel(dashboard, latestSwot, gapsExpanded);

	return (
		<div className="grid min-w-0 gap-4">
			<OverviewHeroMetrics
				selectedProjectId={selectedProjectId}
				selectedProject={selectedProject}
				refetch={refetch}
				progressTrack={progressTrack}
				onNavigate={onNavigate}
				vm={vm}
			/>
			<OverviewAnalyticsPanels
				selectedProjectId={selectedProjectId}
				progressTrack={progressTrack}
				onNavigate={onNavigate}
				gapsExpanded={gapsExpanded}
				setGapsExpanded={setGapsExpanded}
				vm={vm}
			/>
			<OverviewActivityPanels
				selectedProject={selectedProject}
				toolbarInset={toolbarInset}
				onNavigate={onNavigate}
				vm={vm}
			/>
		</div>
	);
}
