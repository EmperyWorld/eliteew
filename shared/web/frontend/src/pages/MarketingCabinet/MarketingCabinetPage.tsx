/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hosts the Marketing Cabinet shell and lazy-loads its domain views.
 * AMKA now enters through the standalone feature boundary while the cabinet remains its first client.
 *
 * Invariants:
 * - export const MarketingCabinetPage AND export default remain on this path for Desktop lazy mount.
 * - Cabinet navigation keeps existing view ids and permissions stable.
 *
 * Related:
 * - marketingCabinetPage/useMarketingCabinetPageCompose.ts
 * - documentation/product/marketing/MARKETING-CABINET.md
 */
import './marketingCabinetDesktopVars.css';

import * as React from 'react';

import { MarketingCabinetGuideModal } from './components/MarketingCabinetGuideModal';
import { MarketingCabinetToolbar } from './components/MarketingCabinetToolbar';
import { MarketingWebSearchQualityProvider } from './components/MarketingWebSearchQualityContext';
import { MarketingContentSourceProvider } from './hooks/useMarketingContentSource';
import { MarketingCabinetGlobalModals } from './modals/MarketingCabinetGlobalModals';
import { MarketingCabinetPageViewRouter } from './marketingCabinetPage/MarketingCabinetPageViewRouter';
import { useMarketingCabinetPageCompose } from './marketingCabinetPage/useMarketingCabinetPageCompose';
import type { MarketingCabinetPageProps } from './marketingCabinetPageTypes';
import { MarketingCabinetActiveView } from './shell/MarketingCabinetActiveView';
import { MarketingCabinetContentFrame } from './shell/MarketingCabinetContentFrame';
import { MarketingCabinetShell } from './shell/MarketingCabinetShell';
import { MarketingCabinetSidebar } from './shell/MarketingCabinetSidebar';
import { JtbdContextMenuPortal } from './shell/JtbdContextMenuPortal';

export const MarketingCabinetPage: React.FC<MarketingCabinetPageProps> = (
	props
) => {
	const { contentSourceValue, shell, toolbar, viewRouter, overlays } =
		useMarketingCabinetPageCompose(props);

	return (
		<MarketingWebSearchQualityProvider>
			<MarketingContentSourceProvider value={contentSourceValue}>
				<MarketingCabinetShell>
					{shell.isFullDashboardView ? null : (
						<MarketingCabinetSidebar {...shell.sidebar} />
					)}

					<MarketingCabinetContentFrame
						{...shell.contentFrame}
						toolbar={<MarketingCabinetToolbar {...toolbar} />}
					>
						<MarketingCabinetActiveView
							activeView={toolbar.activeView}
							onNavigateToOverview={() =>
								shell.sidebar.onSelectModule('overview')
							}
						>
							<MarketingCabinetPageViewRouter ctx={viewRouter} />
						</MarketingCabinetActiveView>
					</MarketingCabinetContentFrame>
				</MarketingCabinetShell>

				<MarketingCabinetGuideModal {...overlays.guide} />
				<JtbdContextMenuPortal {...overlays.jtbdMenu} />
				<MarketingCabinetGlobalModals {...overlays.globalModals} />
			</MarketingContentSourceProvider>
		</MarketingWebSearchQualityProvider>
	);
};

export default MarketingCabinetPage;
